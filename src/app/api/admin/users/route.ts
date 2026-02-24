import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const tenantId = req.nextUrl.searchParams.get("tenantId")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const users = await db.user.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      tenant: {
        select: { id: true, name: true },
      },
      manager: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

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
    const tenant = await db.tenant.create({
      data: {
        name: tenantName,
        seatLimit: body.seatLimit && body.seatLimit > 0 ? body.seatLimit : 1,
      },
    });
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

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
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
      firstName: body.firstName?.trim() || "Participant",
      lastName: body.lastName?.trim() || "User",
      role: body.role || "EMPLOYEE",
      tenantId,
      managerId: manager?.id,
    },
    update: {
      firstName: body.firstName?.trim() || undefined,
      lastName: body.lastName?.trim() || undefined,
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
