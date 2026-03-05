import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role, TenantType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { buildCsv } from "@/lib/csv";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseLimit(raw: string | null, fallback: number, max: number) {
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
  const take = parseLimit(
    params.get("limit"),
    isCsv ? 2000 : 100,
    isCsv ? 5000 : 500,
  );

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
  if (role) where.role = role;
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

  let users: UserListRow[] = [];
  try {
    users = await db.user.findMany({
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
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const legacyWhere: Prisma.UserWhereInput = { ...where };
    delete (legacyWhere as { tenant?: unknown }).tenant;

    const legacyUsers = await db.user.findMany({
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
    });

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

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = (await req.json()) as {
    tenantId?: string;
    tenantName?: string;
    seatLimit?: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: "ADMIN" | "EMPLOYEE" | "LEADER";
    managerEmail?: string;
    createSoloTenant?: boolean;
  };

  if (!body.email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(body.email);
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

  let tenantId = body.tenantId;
  if (body.createSoloTenant) {
    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "This email already belongs to an existing client. Use Add Individual Participant under that client instead of creating a new solo client.",
          existingTenantId: existingUser.tenant.id,
          existingTenantName: existingUser.tenant.name,
        },
        { status: 409 },
      );
    }

    const tenantName = body.tenantName?.trim() || `Solo - ${body.email}`;
    let tenant;
    try {
      tenant = await db.tenant.create({
        data: {
          name: tenantName,
          type: "SOLO",
          seatLimit: body.seatLimit && body.seatLimit > 0 ? body.seatLimit : 1,
        },
      });
    } catch (error) {
      if (!isSchemaCompatibilityError(error)) throw error;
      tenant = await db.tenant.create({
        data: {
          name: tenantName,
          seatLimit: body.seatLimit && body.seatLimit > 0 ? body.seatLimit : 1,
        },
      });
    }
    tenantId = tenant.id;
  }

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  if (existingUser && existingUser.tenantId !== tenantId) {
    return NextResponse.json(
      {
        error:
          "This email already belongs to a different client. Move/transfer is blocked to prevent accidental reassignment.",
        existingTenantId: existingUser.tenant.id,
        existingTenantName: existingUser.tenant.name,
      },
      { status: 409 },
    );
  }

  let tenant: {
    id: string;
    seatLimit: number;
    isArchived: boolean;
  } | null = null;
  try {
    tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacyTenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, seatLimit: true },
    });
    tenant = legacyTenant
      ? {
          ...legacyTenant,
          isArchived: false,
        }
      : null;
  }
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (tenant.isArchived) {
    return NextResponse.json(
      { error: "Tenant is archived. Restore it before adding users." },
      { status: 400 },
    );
  }

  const manager = body.managerEmail
    ? await db.user.findFirst({
        where: {
          tenantId,
          email: normalizeEmail(body.managerEmail),
        },
      })
    : null;

  const seatCount = await db.seat.count({ where: { tenantId } });
  const existingSeat = await db.seat.findUnique({
    where: {
      tenantId_userEmail: {
        tenantId,
        userEmail: normalizedEmail,
      },
    },
  });

  if (!existingSeat && seatCount >= tenant.seatLimit) {
    return NextResponse.json(
      {
        error: `Seat limit reached (${tenant.seatLimit}). Increase seats before adding more users.`,
      },
      { status: 400 },
    );
  }

  await db.seat.upsert({
    where: {
      tenantId_userEmail: {
        tenantId,
        userEmail: normalizedEmail,
      },
    },
    create: {
      tenantId,
      userEmail: normalizedEmail,
      assigned: false,
    },
    update: {
      assigned: existingSeat?.assigned ?? false,
    },
  });

  const user = await db.user.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      firstName: body.firstName?.trim() || "",
      lastName: body.lastName?.trim() || "",
      role: body.role || "EMPLOYEE",
      tenantId,
      managerId: manager?.id,
    },
    update: {
      firstName:
        typeof body.firstName === "string" ? body.firstName.trim() : undefined,
      lastName:
        typeof body.lastName === "string" ? body.lastName.trim() : undefined,
      role: body.role || undefined,
      tenantId,
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

  return NextResponse.json({ user });
}
