import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { cancelOutstandingUnenrollJobs } from "@/lib/unenroll-jobs";
import { IdentityPolicyError } from "@/lib/identity-policy";

type EnrollmentBody = {
  scope?: "USER" | "TENANT";
  targetId?: string;
  includeFutureUsers?: boolean;
  reportMode?: "AUTO" | "MANUAL";
  reportDelayHours?: number;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const body = (await req.json().catch(() => null)) as EnrollmentBody | null;

  const scope = body?.scope;
  const targetId = body?.targetId?.trim();

  if (!scope || !targetId) {
    return NextResponse.json(
      { error: "scope and targetId are required." },
      { status: 400 },
    );
  }
  if (
    body?.reportDelayHours !== undefined &&
    (!Number.isInteger(body.reportDelayHours) ||
      body.reportDelayHours < 0 ||
      body.reportDelayHours > 8_760)
  ) {
    return NextResponse.json(
      { error: "reportDelayHours must be a whole number between 0 and 8760." },
      { status: 400 },
    );
  }

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (scope === "USER") {
    const user = await db.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        role: true,
        tenantId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.role === "ADMIN") {
      return NextResponse.json(
        { error: "Admin users cannot be enrolled as assessment participants." },
        { status: 400 },
      );
    }

    let enrollment;
    try {
      enrollment = await db.$transaction(async (tx) => {
        const liveUser = await tx.user.findUnique({
          where: { id: user.id },
          select: { role: true, tenantId: true },
        });
        if (!liveUser || liveUser.role === "ADMIN") {
          throw new IdentityPolicyError(
            "TARGET_NOT_PARTICIPANT",
            "Admin users cannot be enrolled as assessment participants.",
            409,
          );
        }
        const changed = await tx.assessmentUserEnrollment.upsert({
          where: {
            assessmentId_userId: {
              assessmentId,
              userId: user.id,
            },
          },
          create: {
            assessmentId,
            userId: user.id,
            active: true,
            reportMode: body?.reportMode ?? "AUTO",
            reportDelayHours: body?.reportDelayHours ?? 0,
            createdByAdminId: check.session.user.id,
          },
          update: {
            active: true,
            reportMode: body?.reportMode ?? "AUTO",
            reportDelayHours: body?.reportDelayHours ?? 0,
            createdByAdminId: check.session.user.id,
          },
        });
        const cancellation = await cancelOutstandingUnenrollJobs(tx, {
          assessmentId,
          targetScope: "USER",
          targetId: user.id,
        });
        const clearedOverrides = await tx.assessmentReportAccessOverride.deleteMany({
          where: { assessmentId, userId: user.id },
        });
        await recordAuditLog(
          {
            tenantId: liveUser.tenantId,
            actorId: check.session.user.id,
            action: "assessment.user_enrolled",
            metadata: {
              assessmentId,
              userId: user.id,
              reportMode: changed.reportMode,
              reportDelayHours: changed.reportDelayHours,
              clearedOverrides: clearedOverrides.count,
              ...cancellation,
            },
          },
          tx,
        );
        return changed;
      });
    } catch (error) {
      if (error instanceof IdentityPolicyError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }
      if (!isSchemaCompatibilityError(error)) throw error;
      return NextResponse.json(
        { error: "Database migration required for explicit enrollment actions." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      enrollment,
      scope,
      targetId: user.id,
    });
  }

  let tenant: { id: string; isArchived: boolean } | null = null;
  try {
    tenant = await db.tenant.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        isArchived: true,
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacyTenant = await db.tenant.findUnique({
      where: { id: targetId },
      select: {
        id: true,
      },
    });
    tenant = legacyTenant
      ? {
        id: legacyTenant.id,
        isArchived: false,
      }
      : null;
  }

  if (!tenant) {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }

  if (tenant.isArchived) {
    return NextResponse.json(
      { error: "Cannot enroll an archived organisation." },
      { status: 400 },
    );
  }

  let enrollment;
  try {
    enrollment = await db.$transaction(async (tx) => {
      const changed = await tx.assessmentTenantEnrollment.upsert({
        where: {
          assessmentId_tenantId: {
            assessmentId,
            tenantId: tenant.id,
          },
        },
        create: {
          assessmentId,
          tenantId: tenant.id,
          includeFutureUsers: body?.includeFutureUsers ?? true,
          active: true,
          reportMode: body?.reportMode ?? "AUTO",
          reportDelayHours: body?.reportDelayHours ?? 0,
          createdByAdminId: check.session.user.id,
        },
        update: {
          active: true,
          includeFutureUsers: body?.includeFutureUsers ?? true,
          reportMode: body?.reportMode ?? "AUTO",
          reportDelayHours: body?.reportDelayHours ?? 0,
          createdByAdminId: check.session.user.id,
        },
      });
      const eligibleUsers = await tx.user.findMany({
        where: {
          tenantId: tenant.id,
          role: { in: ["EMPLOYEE", "LEADER"] },
          ...(!changed.includeFutureUsers
            ? { createdAt: { lte: changed.createdAt } }
            : {}),
        },
        select: { id: true },
      });
      const cancellation = await cancelOutstandingUnenrollJobs(tx, {
        assessmentId,
        targetScope: "TENANT",
        targetId: tenant.id,
      });
      const clearedOverrides = await tx.assessmentReportAccessOverride.deleteMany({
        where: {
          assessmentId,
          userId: { in: eligibleUsers.map((user) => user.id) },
        },
      });
      await recordAuditLog(
        {
          tenantId: tenant.id,
          actorId: check.session.user.id,
          action: "assessment.organisation_enrolled",
          metadata: {
            assessmentId,
            tenantId: tenant.id,
            includeFutureUsers: changed.includeFutureUsers,
            reportMode: changed.reportMode,
            reportDelayHours: changed.reportDelayHours,
            clearedOverrides: clearedOverrides.count,
            ...cancellation,
          },
        },
        tx,
      );
      return changed;
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    return NextResponse.json(
      { error: "Database migration required for explicit enrollment actions." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    enrollment,
    scope,
    targetId: tenant.id,
  });
}
