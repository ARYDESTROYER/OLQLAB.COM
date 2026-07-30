import { NextRequest, NextResponse } from "next/server";
import { Prisma, TenantType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { buildCsv } from "@/lib/csv";
import { recordAuditLog } from "@/lib/audit-log";
import {
  buildAdminListWindowMeta,
  getAdminCsvWindowError,
} from "@/lib/admin-list-window";

const MAX_ORGANISATION_NAME_LENGTH = 160;
const MAX_SEAT_LIMIT = 100_000;
const MAX_CSV_BYTES = 4 * 1024 * 1024;

type SeatState = "HAS_ROOM" | "AT_CAPACITY" | "OVER_CAPACITY";

function parseLimit(raw: string | null, fallback: number, max: number) {
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return 1;
  return Math.min(rounded, max);
}

function getSeatState(seatLimit: number, seatsUsed: number): SeatState {
  if (seatsUsed > seatLimit) return "OVER_CAPACITY";
  if (seatsUsed === seatLimit) return "AT_CAPACITY";
  return "HAS_ROOM";
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const includeArchived = params.get("includeArchived") === "1";
  const typeParam = params.get("type")?.trim().toUpperCase();
  const seatStateParam = params.get("seatState")?.trim().toUpperCase();
  const sortBy = params.get("sortBy")?.trim() || "updatedAt";
  const sortOrder = params.get("sortOrder")?.trim().toLowerCase() === "asc" ? "asc" : "desc";
  const format = params.get("format")?.trim().toLowerCase();
  const isCsv = format === "csv";
  const take = parseLimit(params.get("limit"), isCsv ? 5000 : 100, isCsv ? 5000 : 500);
  const fetchLimit = Math.max(take, isCsv ? take : 500);

  const tenantType: TenantType | undefined =
    typeParam === "ORGANIZATION" || typeParam === "SOLO" ? typeParam : undefined;
  const seatState: SeatState | undefined =
    seatStateParam === "HAS_ROOM" ||
    seatStateParam === "AT_CAPACITY" ||
    seatStateParam === "OVER_CAPACITY"
      ? seatStateParam
      : undefined;

  type TenantListRow = {
    id: string;
    name: string;
    type: TenantType;
    isArchived: boolean;
    seatLimit: number;
    createdAt: Date;
    updatedAt: Date;
    seatsUsed: number;
    usersCount: number;
    seatUtilization: number;
    seatState: SeatState;
  };

  const where: Prisma.TenantWhereInput = {
    ...(q
      ? {
          name: {
            contains: q,
            mode: "insensitive",
          },
        }
      : {}),
    ...(includeArchived ? {} : { isArchived: false }),
    ...(tenantType ? { type: tenantType } : {}),
  };

  let rows: TenantListRow[] = [];
  let totalCandidates = 0;
  let processedCandidates = 0;
  try {
    const [tenants, candidateCount] = await Promise.all([
      db.tenant.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              seats: true,
              tenantEnrollments: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: fetchLimit,
      }),
      db.tenant.count({ where }),
    ]);
    totalCandidates = candidateCount;
    processedCandidates = tenants.length;

    rows = tenants.map((tenant) => {
      const seatsUsed = tenant._count.seats;
      const state = getSeatState(tenant.seatLimit, seatsUsed);
      return {
        id: tenant.id,
        name: tenant.name,
        type: tenant.type,
        isArchived: tenant.isArchived,
        seatLimit: tenant.seatLimit,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        seatsUsed,
        usersCount: tenant._count.users,
        seatUtilization:
          tenant.seatLimit > 0 ? Math.round((seatsUsed / tenant.seatLimit) * 100) : 0,
        seatState: state,
      };
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const legacyWhere: Prisma.TenantWhereInput = {
      ...(q
        ? {
            name: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
    };
    const [legacyTenants, candidateCount] = await Promise.all([
      db.tenant.findMany({
        where: legacyWhere,
        include: {
          _count: {
            select: {
              users: true,
              seats: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: fetchLimit,
      }),
      db.tenant.count({ where: legacyWhere }),
    ]);
    totalCandidates = candidateCount;
    processedCandidates = legacyTenants.length;

    rows = legacyTenants.map((tenant) => {
      const seatsUsed = tenant._count.seats;
      const state = getSeatState(tenant.seatLimit, seatsUsed);
      return {
        id: tenant.id,
        name: tenant.name,
        type: "ORGANIZATION",
        isArchived: false,
        seatLimit: tenant.seatLimit,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        seatsUsed,
        usersCount: tenant._count.users,
        seatUtilization:
          tenant.seatLimit > 0 ? Math.round((seatsUsed / tenant.seatLimit) * 100) : 0,
        seatState: state,
      };
    });
  }

  if (seatState) {
    rows = rows.filter((row) => row.seatState === seatState);
  }

  rows.sort((a, b) => {
    const direction = sortOrder === "asc" ? 1 : -1;
    if (sortBy === "name") return a.name.localeCompare(b.name) * direction;
    if (sortBy === "seatLimit") return (a.seatLimit - b.seatLimit) * direction;
    if (sortBy === "seatsUsed") return (a.seatsUsed - b.seatsUsed) * direction;
    if (sortBy === "seatUtilization") return (a.seatUtilization - b.seatUtilization) * direction;
    if (sortBy === "createdAt") {
      return (a.createdAt.getTime() - b.createdAt.getTime()) * direction;
    }
    return (a.updatedAt.getTime() - b.updatedAt.getTime()) * direction;
  });

  const filteredRows = rows.slice(0, take);

  if (isCsv) {
    const csvWindowError = getAdminCsvWindowError({
      totalCandidates,
      limit: take,
      recordLabel: "organisations",
      derivedFilterApplied: Boolean(seatState),
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
        "name",
        "type",
        "isArchived",
        "seatLimit",
        "seatsUsed",
        "usersCount",
        "seatUtilizationPercent",
        "seatState",
        "createdAt",
        "updatedAt",
      ],
      filteredRows.map((row) => [
        row.id,
        row.name,
        row.type,
        row.isArchived,
        row.seatLimit,
        row.seatsUsed,
        row.usersCount,
        row.seatUtilization,
        row.seatState,
        row.createdAt,
        row.updatedAt,
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
        "Content-Disposition": `attachment; filename="admin-tenants-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    tenants: filteredRows,
    meta: buildAdminListWindowMeta({
      returned: filteredRows.length,
      limit: take,
      totalCandidates,
      processedCandidates,
      matchingWithinWindow: rows.length,
      derivedFilterApplied: Boolean(seatState),
    }),
  });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { name, seatLimit, type } = body as {
    name?: string;
    seatLimit?: number;
    type?: "ORGANIZATION" | "SOLO";
  };

  const tenantName = name?.trim();
  if (!tenantName) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (tenantName.length > MAX_ORGANISATION_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${MAX_ORGANISATION_NAME_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }
  if (type === "SOLO") {
    return NextResponse.json(
      { error: "Solo accounts must be created from Add Solo Participant." },
      { status: 400 },
    );
  }
  if (
    seatLimit !== undefined &&
    (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > MAX_SEAT_LIMIT)
  ) {
    return NextResponse.json(
      { error: `seatLimit must be a whole number between 1 and ${MAX_SEAT_LIMIT}.` },
      { status: 400 },
    );
  }

  const tenant = await db.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        name: tenantName,
        type: "ORGANIZATION",
        seatLimit: seatLimit || 50,
      },
    });

    await recordAuditLog(
      {
        tenantId: created.id,
        actorId: check.session.user.id,
        action: "admin.organisation.created",
        metadata: {
          name: created.name,
          seatLimit: created.seatLimit,
          type: created.type,
        },
      },
      tx,
    );
    return created;
  });

  return NextResponse.json(tenant, { status: 201 });
}
