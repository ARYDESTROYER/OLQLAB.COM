import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import { db } from "@/lib/db";
import {
  assertAdminRoleChangeAllowed,
  assertRoleAllowedInOrganisation,
  IdentityPolicyError,
  type AccountRole,
} from "@/lib/identity-policy";
import {
  hasTenantSeatCapacity,
  lockTenantSeatInventory,
} from "@/lib/tenant-seat-lock";

const MAX_NAME_LENGTH = 100;
const MAX_ORGANISATION_NAME_LENGTH = 160;

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

function policyErrorResponse(error: IdentityPolicyError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

async function wouldCreateManagerCycle(
  tx: Prisma.TransactionClient,
  userId: string,
  managerId: string,
) {
  const rows = await tx.$queryRaw<Array<{ createsCycle: boolean }>>(Prisma.sql`
    WITH RECURSIVE manager_chain AS (
      SELECT "id", "managerId"
      FROM "User"
      WHERE "id" = ${managerId}
      UNION
      SELECT parent."id", parent."managerId"
      FROM "User" parent
      INNER JOIN manager_chain child ON parent."id" = child."managerId"
    )
    SELECT EXISTS(
      SELECT 1 FROM manager_chain WHERE "id" = ${userId}
    ) AS "createsCycle"
  `);
  return Boolean(rows[0]?.createsCycle);
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

  if (
    body.role !== undefined &&
    body.role !== "ADMIN" &&
    body.role !== "EMPLOYEE" &&
    body.role !== "LEADER"
  ) {
    return NextResponse.json({ error: "Invalid account role." }, { status: 400 });
  }
  for (const [field, value] of [
    ["firstName", body.firstName],
    ["lastName", body.lastName],
  ] as const) {
    if (value !== undefined && value.trim().length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `${field} must be ${MAX_NAME_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }
  }
  if (
    body.soloTenantName !== undefined &&
    (!body.soloTenantName.trim() ||
      body.soloTenantName.trim().length > MAX_ORGANISATION_NAME_LENGTH)
  ) {
    return NextResponse.json(
      {
        error: `Solo Organisation name must be between 1 and ${MAX_ORGANISATION_NAME_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }
  if (body.convertToSolo && body.tenantId?.trim()) {
    return NextResponse.json(
      { error: "Choose either an Organisation or Convert to Solo, not both." },
      { status: 400 },
    );
  }

  try {
    const updated = await db.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            tenantId: true,
            managerId: true,
            role: true,
          },
        });
        if (!user) {
          throw new IdentityPolicyError("USER_NOT_FOUND", "User not found.", 404);
        }

        const nextRole: AccountRole = body.role || user.role;
        const activeAdminCount =
          user.role === "ADMIN" && nextRole !== "ADMIN"
            ? await tx.user.count({
                where: {
                  role: "ADMIN",
                  tenant: {
                    type: "ORGANIZATION",
                    isArchived: false,
                  },
                },
              })
            : 0;
        assertAdminRoleChangeAllowed({
          actorId: check.session.user.id,
          targetId: user.id,
          currentRole: user.role,
          nextRole,
          activeAdminCount,
        });

        let createdSoloTenant = false;
        let targetTenantId = body.tenantId?.trim() || user.tenantId;
        if (body.convertToSolo) {
          if (nextRole === "ADMIN") {
            throw new IdentityPolicyError(
              "ADMIN_REQUIRES_ORGANISATION",
              "Admin accounts cannot be converted to Solo.",
            );
          }
          const soloTenant = await tx.tenant.create({
            data: {
              name: body.soloTenantName?.trim() || `Solo - ${user.email}`,
              type: "SOLO",
              seatLimit: 1,
            },
            select: { id: true },
          });
          targetTenantId = soloTenant.id;
          createdSoloTenant = true;
        }

        if (!createdSoloTenant && targetTenantId !== user.tenantId) {
          await lockTenantSeatInventory(tx, targetTenantId);
        }

        const targetTenant = await tx.tenant.findUnique({
          where: { id: targetTenantId },
          select: {
            id: true,
            type: true,
            isArchived: true,
            seatLimit: true,
          },
        });
        if (!targetTenant) {
          throw new IdentityPolicyError(
            "ORGANISATION_NOT_FOUND",
            "Target Organisation not found.",
            404,
          );
        }
        if (
          targetTenant.type === "SOLO" &&
          targetTenant.id !== user.tenantId &&
          !createdSoloTenant
        ) {
          throw new IdentityPolicyError(
            "SOLO_TARGET_INVALID",
            "Accounts can only become Solo through the Convert to Solo action.",
          );
        }
        assertRoleAllowedInOrganisation({
          role: nextRole,
          organisationType: targetTenant.type,
          isArchived: targetTenant.isArchived,
        });

        const movingOrganisation = targetTenant.id !== user.tenantId;
        const managerWasProvided = Object.prototype.hasOwnProperty.call(body, "managerEmail");
        const normalizedManagerEmail =
          typeof body.managerEmail === "string" ? normalizeEmail(body.managerEmail) : "";
        const manager = normalizedManagerEmail
          ? await tx.user.findFirst({
              where: {
                tenantId: targetTenant.id,
                email: normalizedManagerEmail,
                role: "LEADER",
              },
              select: { id: true },
            })
          : null;

        if (normalizedManagerEmail && !manager) {
          throw new IdentityPolicyError(
            "MANAGER_NOT_FOUND",
            "Manager must be an existing Leader in the same Organisation.",
          );
        }
        if (manager?.id === user.id) {
          throw new IdentityPolicyError(
            "SELF_MANAGER",
            "An account cannot be its own manager.",
          );
        }
        if (manager && (await wouldCreateManagerCycle(tx, user.id, manager.id))) {
          throw new IdentityPolicyError(
            "MANAGER_CYCLE",
            "This manager assignment would create a reporting cycle.",
          );
        }
        if (nextRole === "ADMIN" && manager) {
          throw new IdentityPolicyError(
            "ADMIN_MANAGER_NOT_ALLOWED",
            "Admin accounts cannot be assigned a participant manager.",
          );
        }

        const nextManagerId =
          nextRole === "ADMIN"
            ? null
            : managerWasProvided
              ? manager?.id || null
              : movingOrganisation
                ? null
                : user.managerId;

        let deactivatedDirectEnrollments = 0;
        let clearedReportOverrides = 0;
        let revokedShareTokens = 0;
        let clearedDirectReports = 0;
        if (user.role !== "ADMIN" && nextRole === "ADMIN") {
          const [enrollments, overrides, shareTokens] = await Promise.all([
            tx.assessmentUserEnrollment.updateMany({
              where: { userId: user.id, active: true },
              data: { active: false },
            }),
            tx.assessmentReportAccessOverride.deleteMany({
              where: { userId: user.id },
            }),
            tx.assessmentReportShareToken.updateMany({
              where: { userId: user.id, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]);
          deactivatedDirectEnrollments = enrollments.count;
          clearedReportOverrides = overrides.count;
          revokedShareTokens = shareTokens.count;
        }

        const normalizedEmail = normalizeEmail(user.email);
        if (movingOrganisation) {
          const [existingTargetSeat, targetSeatCount] = await Promise.all([
            tx.seat.findUnique({
              where: {
                tenantId_userEmail: {
                  tenantId: targetTenant.id,
                  userEmail: normalizedEmail,
                },
              },
              select: { id: true },
            }),
            tx.seat.count({ where: { tenantId: targetTenant.id } }),
          ]);
          if (
            !hasTenantSeatCapacity({
              seatLimit: targetTenant.seatLimit,
              currentSeatCount: targetSeatCount,
              hasExistingSeat: Boolean(existingTargetSeat),
            })
          ) {
            throw new IdentityPolicyError(
              "SEAT_LIMIT_REACHED",
              `Target Organisation seat limit reached (${targetTenant.seatLimit}).`,
            );
          }

          await tx.seat.deleteMany({
            where: {
              tenantId: user.tenantId,
              userEmail: normalizedEmail,
            },
          });
          await tx.seat.upsert({
            where: {
              tenantId_userEmail: {
                tenantId: targetTenant.id,
                userEmail: normalizedEmail,
              },
            },
            create: {
              tenantId: targetTenant.id,
              userEmail: normalizedEmail,
              assigned: false,
            },
            update: { assigned: false },
          });
        }

        if (
          movingOrganisation ||
          (user.role === "LEADER" && nextRole !== "LEADER")
        ) {
          const directReports = await tx.user.updateMany({
            where: { managerId: user.id },
            data: { managerId: null },
          });
          clearedDirectReports = directReports.count;
        }

        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            firstName: maybeTrimmed(body.firstName),
            lastName: maybeTrimmed(body.lastName),
            role: nextRole,
            tenantId: targetTenant.id,
            managerId: nextManagerId,
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

        await recordAuditLog(
          {
            tenantId: targetTenant.id,
            actorId: check.session.user.id,
            action: "admin.user.identity_updated",
            metadata: {
              userId: user.id,
              previousRole: user.role,
              role: nextRole,
              previousTenantId: user.tenantId,
              tenantId: targetTenant.id,
              previousManagerId: user.managerId,
              managerId: nextManagerId,
              deactivatedDirectEnrollments,
              clearedReportOverrides,
              revokedShareTokens,
              clearedDirectReports,
              tenantEnrollmentSuppressedByAdminRole: nextRole === "ADMIN",
            },
          },
          tx,
        );

        return updatedUser;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    if (error instanceof IdentityPolicyError) return policyErrorResponse(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The account changed concurrently. Please try again." },
        { status: 409 },
      );
    }
    throw error;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  if (id === check.session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 409 },
    );
  }

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

  await db.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { session: { userId: user.id } } });
    await tx.quizSession.deleteMany({ where: { userId: user.id } });
    await tx.score.deleteMany({ where: { userId: user.id } });
    await tx.report.deleteMany({ where: { userId: user.id } });
    await tx.reportArchive.deleteMany({ where: { userId: user.id } });
    await tx.assessmentUserEnrollment.deleteMany({ where: { userId: user.id } });
    await tx.retestEligibility.deleteMany({ where: { userId: user.id } });
    await tx.assessmentReportAccessOverride.deleteMany({ where: { userId: user.id } });
    await tx.assessmentReportShareToken.deleteMany({ where: { userId: user.id } });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.invite.deleteMany({
      where: {
        tenantId: user.tenantId,
        email: normalizeEmail(user.email),
      },
    });
    await tx.seat.deleteMany({
      where: {
        tenantId: user.tenantId,
        userEmail: normalizeEmail(user.email),
      },
    });
    await tx.user.updateMany({
      where: { managerId: user.id },
      data: { managerId: null },
    });
    await tx.user.delete({ where: { id: user.id } });
    await recordAuditLog(
      {
        tenantId: user.tenantId,
        actorId: check.session.user.id,
        action: "admin.user.deleted",
        metadata: {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
      },
      tx,
    );
  });

  return NextResponse.json({
    ok: true,
    deletedUserId: user.id,
    deletedUserName: `${user.firstName} ${user.lastName}`.trim(),
  });
}
