import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role, TenantType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { buildCsv } from "@/lib/csv";
import { getAdminUserStats } from "@/lib/admin-user-stats";
import {
  assertRoleAllowedInOrganisation,
  IdentityPolicyError,
  type AccountRole,
} from "@/lib/identity-policy";
import { recordAuditLog } from "@/lib/audit-log";
import {
  hasTenantSeatCapacity,
  lockTenantSeatInventory,
} from "@/lib/tenant-seat-lock";
import {
  buildAdminListWindowMeta,
  getAdminCsvWindowError,
} from "@/lib/admin-list-window";

const MAX_EMAIL_LENGTH = 320;
const MAX_NAME_LENGTH = 100;
const MAX_ORGANISATION_NAME_LENGTH = 160;
const MAX_CSV_BYTES = 4 * 1024 * 1024;
const emailSchema = z.string().trim().email().max(MAX_EMAIL_LENGTH);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseLimit(raw: string | null, fallback: number, max: number) {
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return 1;
  return Math.min(rounded, max);
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const params = req.nextUrl.searchParams;
  const scopeParam = params.get("scope")?.trim().toUpperCase();
  const tenantId = params.get("tenantId")?.trim();
  const q = params.get("q")?.trim();
  const roleParam = params.get("role")?.trim().toUpperCase();
  const tenantTypeParam = params.get("tenantType")?.trim().toUpperCase();
  const hasManagerParam = params.get("hasManager")?.trim();
  const tenantArchivedParam = params.get("tenantArchived")?.trim();
  const sortBy = params.get("sortBy")?.trim() || "createdAt";
  const sortOrder = params.get("sortOrder")?.trim().toLowerCase() === "asc" ? "asc" : "desc";
  const format = params.get("format")?.trim().toLowerCase();
  const isCsv = format === "csv";
  const includeContext = !isCsv && params.get("includeContext") !== "0";
  const take = parseLimit(
    params.get("limit"),
    isCsv ? 5000 : 100,
    isCsv ? 5000 : 500,
  );
  const scope: "ALL" | "PARTICIPANTS" = scopeParam === "PARTICIPANTS" ? "PARTICIPANTS" : "ALL";

  const role: Role | undefined =
    roleParam === "ADMIN" || roleParam === "EMPLOYEE" || roleParam === "LEADER"
      ? roleParam
      : undefined;
  const tenantType: TenantType | undefined =
    tenantTypeParam === "ORGANIZATION" || tenantTypeParam === "SOLO"
      ? tenantTypeParam
      : undefined;

  const where: Prisma.UserWhereInput = {};
  if (tenantId) where.tenantId = tenantId;
  if (scope === "PARTICIPANTS") {
    if (role === "ADMIN") {
      where.id = "__none__";
    } else if (role) {
      where.role = role;
    } else {
      where.role = { in: ["EMPLOYEE", "LEADER"] };
    }
  } else if (role) {
    where.role = role;
  }

  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (hasManagerParam === "1") where.managerId = { not: null };
  if (hasManagerParam === "0") where.managerId = null;

  const tenantWhere: Prisma.TenantWhereInput = {};
  if (tenantType) tenantWhere.type = tenantType;
  if (tenantArchivedParam === "1") tenantWhere.isArchived = true;
  if (tenantArchivedParam === "0") tenantWhere.isArchived = false;
  if (Object.keys(tenantWhere).length > 0) where.tenant = tenantWhere;

  let orderBy:
    | Prisma.UserOrderByWithRelationInput
    | Prisma.UserOrderByWithRelationInput[] = { createdAt: sortOrder };
  if (sortBy === "email") {
    orderBy = { email: sortOrder };
  } else if (sortBy === "name") {
    orderBy = [{ firstName: sortOrder }, { lastName: sortOrder }];
  } else if (sortBy === "updatedAt") {
    orderBy = { updatedAt: sortOrder };
  }

  type UserListRow = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
    tenant: {
      id: string;
      name: string;
      type: TenantType;
      isArchived: boolean;
    };
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  };

  type OrganizationSummary = {
    organizationId: string;
    name: string;
    isArchived: boolean;
    totalUsers: number;
    participantUsers: number;
    adminUsers: number;
  };

  const contextPromise = includeContext
    ? Promise.all([
        getAdminUserStats(),
        (async (): Promise<OrganizationSummary[]> => {
      try {
        const organizationTenants = await db.tenant.findMany({
          where: { type: "ORGANIZATION" },
          select: { id: true, name: true, isArchived: true },
          orderBy: { name: "asc" },
        });

        if (organizationTenants.length === 0) return [];

        const grouped = await db.user.groupBy({
          by: ["tenantId", "role"],
          where: {
            tenantId: { in: organizationTenants.map((tenant) => tenant.id) },
          },
          _count: {
            _all: true,
          },
        });

        const countsByTenant = new Map<
          string,
          { totalUsers: number; participantUsers: number; adminUsers: number }
        >();
        for (const row of grouped) {
          const existing = countsByTenant.get(row.tenantId) || {
            totalUsers: 0,
            participantUsers: 0,
            adminUsers: 0,
          };
          existing.totalUsers += row._count._all;
          if (row.role === "ADMIN") existing.adminUsers += row._count._all;
          if (row.role === "EMPLOYEE" || row.role === "LEADER") {
            existing.participantUsers += row._count._all;
          }
          countsByTenant.set(row.tenantId, existing);
        }

        return organizationTenants.map((tenant) => {
          const counts = countsByTenant.get(tenant.id) || {
            totalUsers: 0,
            participantUsers: 0,
            adminUsers: 0,
          };
          return {
            organizationId: tenant.id,
            name: tenant.name,
            isArchived: tenant.isArchived,
            totalUsers: counts.totalUsers,
            participantUsers: counts.participantUsers,
            adminUsers: counts.adminUsers,
          };
        });
      } catch (error) {
        if (!isSchemaCompatibilityError(error)) throw error;

        const legacyTenants = await db.tenant.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
        if (legacyTenants.length === 0) return [];

        const grouped = await db.user.groupBy({
          by: ["tenantId", "role"],
          where: {
            tenantId: { in: legacyTenants.map((tenant) => tenant.id) },
          },
          _count: {
            _all: true,
          },
        });

        const countsByTenant = new Map<
          string,
          { totalUsers: number; participantUsers: number; adminUsers: number }
        >();
        for (const row of grouped) {
          const existing = countsByTenant.get(row.tenantId) || {
            totalUsers: 0,
            participantUsers: 0,
            adminUsers: 0,
          };
          existing.totalUsers += row._count._all;
          if (row.role === "ADMIN") existing.adminUsers += row._count._all;
          if (row.role === "EMPLOYEE" || row.role === "LEADER") {
            existing.participantUsers += row._count._all;
          }
          countsByTenant.set(row.tenantId, existing);
        }

        return legacyTenants.map((tenant) => {
          const counts = countsByTenant.get(tenant.id) || {
            totalUsers: 0,
            participantUsers: 0,
            adminUsers: 0,
          };
          return {
            organizationId: tenant.id,
            name: tenant.name,
            isArchived: false,
            totalUsers: counts.totalUsers,
            participantUsers: counts.participantUsers,
            adminUsers: counts.adminUsers,
          };
        });
      }
        })(),
      ])
    : Promise.resolve([null, []] as [null, OrganizationSummary[]]);

  let users: UserListRow[] = [];
  let totalMatchingFilters = 0;
  try {
    [users, totalMatchingFilters] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          tenant: {
            select: { id: true, name: true, type: true, isArchived: true },
          },
          manager: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy,
        take,
      }),
      includeContext || isCsv ? db.user.count({ where }) : Promise.resolve(0),
    ]);
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const legacyWhere: Prisma.UserWhereInput = { ...where };
    delete (legacyWhere as { tenant?: unknown }).tenant;

    const [legacyUsers, legacyCount] = await Promise.all([
      db.user.findMany({
        where: legacyWhere,
        include: {
          tenant: {
            select: { id: true, name: true },
          },
          manager: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy,
        take,
      }),
      includeContext || isCsv
        ? db.user.count({ where: legacyWhere })
        : Promise.resolve(0),
    ]);
    totalMatchingFilters = legacyCount;

    users = legacyUsers.map((user) => ({
      ...user,
      tenant: {
        ...user.tenant,
        type: "ORGANIZATION",
        isArchived: false,
      },
    }));
  }

  if (isCsv) {
    const csvWindowError = getAdminCsvWindowError({
      totalCandidates: totalMatchingFilters,
      limit: take,
      recordLabel: "users",
    });
    if (csvWindowError) {
      return NextResponse.json(
        { error: csvWindowError },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }

    const csv = buildCsv(
      [
        "id",
        "email",
        "firstName",
        "lastName",
        "role",
        "tenantId",
        "tenantName",
        "tenantType",
        "tenantArchived",
        "managerEmail",
        "createdAt",
        "updatedAt",
      ],
      users.map((user) => [
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.role,
        user.tenant?.id,
        user.tenant?.name,
        user.tenant?.type,
        user.tenant?.isArchived ?? false,
        user.manager?.email ?? "",
        user.createdAt,
        user.updatedAt,
      ]),
    );

    if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: "CSV export is too large. Narrow the filters and try again." },
        { status: 413 },
      );
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="admin-users-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const [userStats, organizations] = await contextPromise;

  return NextResponse.json({
    users,
    ...(userStats
      ? {
          organizations,
          meta: {
            scope,
            ...buildAdminListWindowMeta({
              returned: users.length,
              limit: take,
              totalCandidates: totalMatchingFilters,
              processedCandidates: users.length,
              matchingWithinWindow: users.length,
            }),
            totalAllAccounts: userStats.usersTotal,
            totalParticipants: userStats.usersParticipants,
            totalAdmins: userStats.usersAdmins,
          },
        }
      : {}),
  });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = (await req.json().catch(() => null)) as {
    tenantId?: string;
    tenantName?: string;
    seatLimit?: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: "ADMIN" | "EMPLOYEE" | "LEADER";
    managerEmail?: string;
    createSoloTenant?: boolean;
  } | null;

  if (!body?.email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(body.email);
  if (!emailSchema.safeParse(normalizedEmail).success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  for (const [field, value] of [
    ["firstName", body.firstName],
    ["lastName", body.lastName],
  ] as const) {
    if (typeof value === "string" && value.trim().length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `${field} must be ${MAX_NAME_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }
  }
  if (
    typeof body.tenantName === "string" &&
    body.tenantName.trim().length > MAX_ORGANISATION_NAME_LENGTH
  ) {
    return NextResponse.json(
      { error: `Organisation name must be ${MAX_ORGANISATION_NAME_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }
  const requestedRole: AccountRole | null =
    body.role === undefined
      ? "EMPLOYEE"
      : body.role === "ADMIN" || body.role === "EMPLOYEE" || body.role === "LEADER"
        ? body.role
        : null;
  if (!requestedRole) {
    return NextResponse.json({ error: "Invalid account role." }, { status: 400 });
  }

  if (body.createSoloTenant && requestedRole === "ADMIN") {
    return NextResponse.json(
      { error: "Admin accounts must be added to an Organisation." },
      { status: 400 },
    );
  }

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  if (existingUser) {
    return NextResponse.json(
      {
        error:
          "This email already belongs to an account. Use Edit or Move instead of Add User.",
        existingTenantId: existingUser.tenant.id,
        existingTenantName: existingUser.tenant.name,
      },
      { status: 409 },
    );
  }

  const selectedTenantId = body.tenantId?.trim();
  if (!body.createSoloTenant && !selectedTenantId) {
    return NextResponse.json({ error: "Organisation is required." }, { status: 400 });
  }

  try {
    const user = await db.$transaction(
      async (tx) => {
        if (!body.createSoloTenant && selectedTenantId) {
          await lockTenantSeatInventory(tx, selectedTenantId);
        }
        const tenant = body.createSoloTenant
          ? await tx.tenant.create({
              data: {
                name: body.tenantName?.trim() || `Solo - ${normalizedEmail}`,
                type: "SOLO",
                seatLimit: 1,
              },
              select: {
                id: true,
                name: true,
                type: true,
                seatLimit: true,
                isArchived: true,
              },
            })
          : await tx.tenant.findUnique({
              where: { id: selectedTenantId },
              select: {
                id: true,
                name: true,
                type: true,
                seatLimit: true,
                isArchived: true,
              },
            });

        if (!tenant) {
          throw new IdentityPolicyError(
            "ORGANISATION_NOT_FOUND",
            "Organisation not found.",
            404,
          );
        }
        assertRoleAllowedInOrganisation({
          role: requestedRole,
          organisationType: tenant.type,
          isArchived: tenant.isArchived,
        });

        const managerEmail = body.managerEmail?.trim();
        const manager = managerEmail
          ? await tx.user.findFirst({
              where: {
                tenantId: tenant.id,
                email: normalizeEmail(managerEmail),
                role: "LEADER",
              },
              select: { id: true },
            })
          : null;
        if (managerEmail && !manager) {
          throw new IdentityPolicyError(
            "MANAGER_NOT_FOUND",
            "Manager must be an existing Leader in the same Organisation.",
          );
        }
        if (requestedRole === "ADMIN" && manager) {
          throw new IdentityPolicyError(
            "ADMIN_MANAGER_NOT_ALLOWED",
            "Admin accounts cannot be assigned a participant manager.",
          );
        }

        const [seatCount, existingSeat] = await Promise.all([
          tx.seat.count({ where: { tenantId: tenant.id } }),
          tx.seat.findUnique({
            where: {
              tenantId_userEmail: {
                tenantId: tenant.id,
                userEmail: normalizedEmail,
              },
            },
            select: { id: true, assigned: true },
          }),
        ]);
        if (
          !hasTenantSeatCapacity({
            seatLimit: tenant.seatLimit,
            currentSeatCount: seatCount,
            hasExistingSeat: Boolean(existingSeat),
          })
        ) {
          throw new IdentityPolicyError(
            "SEAT_LIMIT_REACHED",
            `Seat limit reached (${tenant.seatLimit}). Increase seats before adding more users.`,
          );
        }

        await tx.seat.upsert({
          where: {
            tenantId_userEmail: {
              tenantId: tenant.id,
              userEmail: normalizedEmail,
            },
          },
          create: {
            tenantId: tenant.id,
            userEmail: normalizedEmail,
            assigned: false,
          },
          update: {
            assigned: existingSeat?.assigned ?? false,
          },
        });

        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            firstName: body.firstName?.trim() || "",
            lastName: body.lastName?.trim() || "",
            role: requestedRole,
            tenantId: tenant.id,
            managerId: manager?.id,
          },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        await recordAuditLog(
          {
            tenantId: tenant.id,
            actorId: check.session.user.id,
            action: "admin.user.created",
            metadata: {
              userId: createdUser.id,
              email: normalizedEmail,
              role: requestedRole,
              managerId: manager?.id || null,
              solo: tenant.type === "SOLO",
            },
          },
          tx,
        );

        return createdUser;
      },
      {
        isolationLevel: body.createSoloTenant
          ? Prisma.TransactionIsolationLevel.Serializable
          : Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof IdentityPolicyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This email already belongs to an account." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The account list changed concurrently. Please try again." },
        { status: 409 },
      );
    }
    throw error;
  }
}
