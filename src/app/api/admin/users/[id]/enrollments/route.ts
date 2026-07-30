import { NextRequest, NextResponse } from "next/server";
import { ReportAccessMode } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import { db } from "@/lib/db";
import {
  IdentityPolicyError,
  validateUnenrollDelivery,
} from "@/lib/identity-policy";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import {
  assertLinkOnlyReportRecipientsReady,
  cancelOutstandingUnenrollJobs,
  runDueUnenrollJobs,
} from "@/lib/unenroll-jobs";

type Body = {
  assessmentId?: string;
  action?: "ENROLL" | "UNENROLL";
  effectiveAt?: string;
  reportMode?: "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE";
  notifyByEmail?: boolean;
  linkTtlHours?: number;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: userId } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;

  const assessmentId = body?.assessmentId?.trim();
  const action = body?.action;

  if (!assessmentId || !action) {
    return NextResponse.json(
      { error: "assessmentId and action are required." },
      { status: 400 },
    );
  }

  const [user, assessment] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, tenantId: true },
    }),
    db.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        policy: { select: { reportWorkflow: true } },
      },
    }),
  ]);

  if (!user || user.role === "ADMIN") {
    return NextResponse.json({ error: "Target user is invalid." }, { status: 400 });
  }

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (action === "ENROLL") {
    let enrollment;
    try {
      enrollment = await db.$transaction(async (tx) => {
        const liveUser = await tx.user.findUnique({
          where: { id: userId },
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
              userId,
            },
          },
          create: {
            assessmentId,
            userId,
            active: true,
            createdByAdminId: check.session.user.id,
          },
          update: {
            active: true,
            createdByAdminId: check.session.user.id,
          },
        });
        const cancellation = await cancelOutstandingUnenrollJobs(tx, {
          assessmentId,
          targetScope: "USER",
          targetId: userId,
        });
        const clearedOverrides = await tx.assessmentReportAccessOverride.deleteMany({
          where: { assessmentId, userId },
        });
        await recordAuditLog(
          {
            tenantId: liveUser.tenantId,
            actorId: check.session.user.id,
            action: "assessment.user_enrolled",
            metadata: {
              assessmentId,
              userId,
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

    return NextResponse.json({ ok: true, action, enrollment });
  }

  const effectiveAt = body?.effectiveAt ? new Date(body.effectiveAt) : new Date();
  if (Number.isNaN(effectiveAt.getTime())) {
    return NextResponse.json({ error: "effectiveAt is invalid." }, { status: 400 });
  }

  const reportMode =
    body?.reportMode && Object.values(ReportAccessMode).includes(body.reportMode)
      ? body.reportMode
      : ReportAccessMode.KEEP_APP_ACCESS;
  const notifyByEmail = Boolean(body?.notifyByEmail);
  const linkTtlHours = body?.linkTtlHours ?? null;
  try {
    validateUnenrollDelivery({ reportMode, notifyByEmail, linkTtlHours });
    if (reportMode === ReportAccessMode.LINK_ONLY) {
      await assertLinkOnlyReportRecipientsReady({
        assessmentId,
        userIds: [userId],
        reportWorkflow: assessment.policy?.reportWorkflow || "AI_STANDARD",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid unenrollment settings.";
    const status = error instanceof IdentityPolicyError ? error.status : 409;
    return NextResponse.json({ error: message }, { status });
  }

  let job;
  try {
    job = await db.$transaction(async (tx) => {
      const created = await tx.assessmentUnenrollJob.create({
        data: {
          assessmentId,
          targetScope: "USER",
          targetId: userId,
          effectiveAt,
          reportMode,
          notifyByEmail,
          linkTtlHours:
            reportMode === ReportAccessMode.LINK_ONLY ? linkTtlHours || 168 : null,
          createdByAdminId: check.session.user.id,
          status: "PENDING",
        },
      });
      await recordAuditLog(
        {
          tenantId: user.tenantId,
          actorId: check.session.user.id,
          action: "unenroll.job.scheduled",
          metadata: {
            jobId: created.id,
            assessmentId,
            scope: "USER",
            targetId: userId,
            effectiveAt: effectiveAt.toISOString(),
            reportMode,
            notifyByEmail,
          },
        },
        tx,
      );
      return created;
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    return NextResponse.json(
      { error: "Database migration required for unenroll jobs." },
      { status: 409 },
    );
  }

  let execution = null;
  if (effectiveAt <= new Date()) {
    execution = await runDueUnenrollJobs({
      forceJobId: job.id,
      executionActorId: check.session.user.id,
      trigger: "admin",
    });
  }

  return NextResponse.json({
    ok: true,
    action,
    job,
    execution,
  });
}
