import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type PatchBody = {
  firstName?: string;
  lastName?: string;
  role?: "ADMIN" | "EMPLOYEE" | "LEADER";
  tenantId?: string;
  managerEmail?: string | null;
  convertToSolo?: boolean;
  soloTenantName?: string;
};

function maybeTrimmed(value: string | undefined) {
  if (typeof value !== "string") return undefined;
  return value.trim();
}

async function ensureSeatCapacity(tenantId: string, email: string) {
  const [tenant, existingSeat, seatCount] = await Promise.all([
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, seatLimit: true },
    }),
    db.seat.findUnique({
      where: {
        tenantId_userEmail: {
          tenantId,
          userEmail: email,
        },
      },
      select: { id: true },
    }),
    db.seat.count({
      where: {
        tenantId,
      },
    }),
  ]);

  if (!tenant) {
    throw new Error("TENANT_NOT_FOUND");
  }

  if (!existingSeat && seatCount >= tenant.seatLimit) {
    throw new Error("SEAT_LIMIT_REACHED");
  }

  return { tenant, existingSeat };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      tenantId: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const normalizedEmail = normalizeEmail(user.email);
  let targetTenantId = body.tenantId?.trim() || user.tenantId;

  if (body.convertToSolo) {
    let soloTenant;
    try {
      soloTenant = await db.tenant.create({
        data: {
          name: body.soloTenantName?.trim() || `Solo - ${user.email}`,
          type: "SOLO",
          seatLimit: 1,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      if (!isSchemaCompatibilityError(error)) throw error;
      soloTenant = await db.tenant.create({
        data: {
          name: body.soloTenantName?.trim() || `Solo - ${user.email}`,
          seatLimit: 1,
        },
        select: {
          id: true,
        },
      });
    }
    targetTenantId = soloTenant.id;
  }

  try {
    await ensureSeatCapacity(targetTenantId, normalizedEmail);
  } catch (error) {
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
      return NextResponse.json({ error: "Target tenant not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "SEAT_LIMIT_REACHED") {
      return NextResponse.json({ error: "Target tenant seat limit reached." }, { status: 400 });
    }
    throw error;
  }

  const manager = body.managerEmail
    ? await db.user.findFirst({
        where: {
          tenantId: targetTenantId,
          email: normalizeEmail(body.managerEmail),
        },
        select: { id: true },
      })
    : null;

  const updated = await db.$transaction(async (tx) => {
    if (targetTenantId !== user.tenantId) {
      await tx.seat.deleteMany({
        where: {
          tenantId: user.tenantId,
          userEmail: normalizedEmail,
        },
      });

      await tx.seat.upsert({
        where: {
          tenantId_userEmail: {
            tenantId: targetTenantId,
            userEmail: normalizedEmail,
          },
        },
        create: {
          tenantId: targetTenantId,
          userEmail: normalizedEmail,
          assigned: false,
        },
        update: {
          assigned: false,
        },
      });
    }

    try {
      return await tx.user.update({
        where: { id: user.id },
        data: {
          firstName: maybeTrimmed(body.firstName),
          lastName: maybeTrimmed(body.lastName),
          role: body.role || undefined,
          tenantId: targetTenantId,
          managerId: body.managerEmail === null ? null : manager?.id,
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          manager: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isSchemaCompatibilityError(error)) throw error;
      return tx.user.update({
        where: { id: user.id },
        data: {
          firstName: maybeTrimmed(body.firstName),
          lastName: maybeTrimmed(body.lastName),
          role: body.role || undefined,
          tenantId: targetTenantId,
          managerId: body.managerEmail === null ? null : manager?.id,
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          manager: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    user: updated,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Admin users cannot be deleted from this action." },
      { status: 400 },
    );
  }

  await db.$transaction([
    db.answer.deleteMany({ where: { session: { userId: user.id } } }),
    db.quizSession.deleteMany({ where: { userId: user.id } }),
    db.score.deleteMany({ where: { userId: user.id } }),
    db.report.deleteMany({ where: { userId: user.id } }),
    db.reportArchive.deleteMany({ where: { userId: user.id } }),
    db.assessmentUserEnrollment.deleteMany({ where: { userId: user.id } }),
    db.retestEligibility.deleteMany({ where: { userId: user.id } }),
    db.assessmentReportAccessOverride.deleteMany({ where: { userId: user.id } }),
    db.assessmentReportShareToken.deleteMany({ where: { userId: user.id } }),
    db.account.deleteMany({ where: { userId: user.id } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.invite.deleteMany({
      where: {
        tenantId: user.tenantId,
        email: normalizeEmail(user.email),
      },
    }),
    db.seat.deleteMany({
      where: {
        tenantId: user.tenantId,
        userEmail: normalizeEmail(user.email),
      },
    }),
    db.user.delete({ where: { id: user.id } }),
  ]);

  return NextResponse.json({
    ok: true,
    deletedUserId: user.id,
    deletedUserName: `${user.firstName} ${user.lastName}`.trim(),
  });
}
