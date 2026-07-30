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
  listUnenrollImpactedUsers,
  runDueUnenrollJobs,
} from "@/lib/unenroll-jobs";

type Body = {
  assessmentId?: string;
  action?: "ENROLL" | "UNENROLL";
  includeFutureUsers?: boolean;
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

  const { id: tenantId } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;

  const assessmentId = body?.assessmentId?.trim();
  const action = body?.action;

  if (!assessmentId || !action) {
    return NextResponse.json(
      { error: "assessmentId and action are required." },
      { status: 400 },
    );
  }

  let tenant: { id: string; isArchived: boolean } | null = null;
  let assessment: {
    id: string;
    policy: { reportWorkflow: "AI_STANDARD" | "MANUAL_PDF_UPLOAD" } | null;
  } | null = null;
  try {
    [tenant, assessment] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, isArchived: true } }),
      db.assessment.findUnique({
        where: { id: assessmentId },
        select: { id: true, policy: { select: { reportWorkflow: true } } },
      }),
    ]);
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const [legacyTenant, legacyAssessment] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
      db.assessment.findUnique({
        where: { id: assessmentId },
        select: { id: true, policy: { select: { reportWorkflow: true } } },
      }),
    ]);
    tenant = legacyTenant
      ? {
          id: legacyTenant.id,
          isArchived: false,
        }
      : null;
    assessment = legacyAssessment;
  }

  if (!tenant) {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (action === "ENROLL") {
    if (tenant.isArchived) {
      return NextResponse.json(
        { error: "Archived organisations cannot be enrolled." },
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
              tenantId,
            },
          },
          create: {
            assessmentId,
            tenantId,
            includeFutureUsers: body?.includeFutureUsers ?? true,
            active: true,
            createdByAdminId: check.session.user.id,
          },
          update: {
            includeFutureUsers: body?.includeFutureUsers ?? true,
            active: true,
            createdByAdminId: check.session.user.id,
          },
        });
        const eligibleUsers = await tx.user.findMany({
          where: {
            tenantId,
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
          targetId: tenantId,
        });
        const clearedOverrides = await tx.assessmentReportAccessOverride.deleteMany({
          where: {
            assessmentId,
            userId: { in: eligibleUsers.map((user) => user.id) },
          },
        });
        await recordAuditLog(
          {
            tenantId,
            actorId: check.session.user.id,
            action: "assessment.organisation_enrolled",
            metadata: {
              assessmentId,
              tenantId,
              includeFutureUsers: body?.includeFutureUsers ?? true,
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
  const impactedUsers = await listUnenrollImpactedUsers({
    assessmentId,
    targetScope: "TENANT",
    targetId: tenantId,
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

  let job;
  try {
    job = await db.$transaction(async (tx) => {
      const created = await tx.assessmentUnenrollJob.create({
        data: {
          assessmentId,
          targetScope: "TENANT",
          targetId: tenantId,
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
          tenantId,
          actorId: check.session.user.id,
          action: "unenroll.job.scheduled",
          metadata: {
            jobId: created.id,
            assessmentId,
            scope: "TENANT",
            targetId: tenantId,
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

  return NextResponse.json({ ok: true, action, job, execution });
}
