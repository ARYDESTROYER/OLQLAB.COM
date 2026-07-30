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
  listUnenrollImpactedUsers,
  lockUnenrollTarget,
  runDueUnenrollJobs,
} from "@/lib/unenroll-jobs";

type UnenrollBody = {
  scope?: "USER" | "TENANT";
  targetId?: string;
  effectiveAt?: string;
  reportMode?: "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE";
  notifyByEmail?: boolean;
  linkTtlHours?: number;
  dryRun?: boolean;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const body = (await req.json().catch(() => null)) as UnenrollBody | null;

  const scope = body?.scope;
  const targetId = body?.targetId?.trim();

  if (!scope || !targetId) {
    return NextResponse.json(
      { error: "scope and targetId are required." },
      { status: 400 },
    );
  }

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      policy: { select: { reportWorkflow: true } },
    },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (scope === "USER") {
    const user = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });

    if (!user || user.role === "ADMIN") {
      return NextResponse.json(
        { error: "Target user is invalid for unenrollment." },
        { status: 400 },
      );
    }
  }

  if (scope === "TENANT") {
    const tenant = await db.tenant.findUnique({
      where: { id: targetId },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Target organisation not found." }, { status: 404 });
    }
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
  const impactedUsers = await listUnenrollImpactedUsers({
    assessmentId,
    targetScope: scope,
    targetId,
  });

  try {
    validateUnenrollDelivery({ reportMode, notifyByEmail, linkTtlHours });
    if (reportMode === ReportAccessMode.LINK_ONLY) {
      await assertLinkOnlyReportRecipientsReady({
        assessmentId,
        userIds: impactedUsers.map((user) => user.id),
        reportWorkflow: assessment.policy?.reportWorkflow || "AI_STANDARD",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid unenrollment settings.";
    const status = error instanceof IdentityPolicyError ? error.status : 409;
    return NextResponse.json({ error: message }, { status });
  }

  if (body?.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      assessmentId,
      scope,
      targetId,
      impactedUsers,
      impactedCount: impactedUsers.length,
    });
  }

  let job;
  try {
    const auditTenantId =
      scope === "TENANT"
        ? targetId
        : impactedUsers[0]?.tenantId || check.session.user.tenantId;
    job = await db.$transaction(async (tx) => {
      await lockUnenrollTarget(tx, { assessmentId, targetScope: scope, targetId });
      const created = await tx.assessmentUnenrollJob.create({
        data: {
          assessmentId,
          targetScope: scope,
          targetId,
          effectiveAt,
          reportMode,
          notifyByEmail,
          linkTtlHours:
            reportMode === ReportAccessMode.LINK_ONLY
              ? linkTtlHours || 168
              : null,
          createdByAdminId: check.session.user.id,
          status: "PENDING",
        },
      });
      await recordAuditLog(
        {
          tenantId: auditTenantId,
          actorId: check.session.user.id,
          action: "unenroll.job.scheduled",
          metadata: {
            jobId: created.id,
            assessmentId,
            scope,
            targetId,
            effectiveAt: effectiveAt.toISOString(),
            reportMode,
            notifyByEmail,
            impactedUsers: impactedUsers.length,
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
    job,
    execution,
  });
}
