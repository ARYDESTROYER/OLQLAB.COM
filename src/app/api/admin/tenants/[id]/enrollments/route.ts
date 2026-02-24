import { NextRequest, NextResponse } from "next/server";
import { ReportAccessMode } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

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
  let assessment: { id: string } | null = null;
  try {
    [tenant, assessment] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, isArchived: true } }),
      db.assessment.findUnique({ where: { id: assessmentId }, select: { id: true } }),
    ]);
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const [legacyTenant, legacyAssessment] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
      db.assessment.findUnique({ where: { id: assessmentId }, select: { id: true } }),
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
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (action === "ENROLL") {
    if (tenant.isArchived) {
      return NextResponse.json(
        { error: "Archived tenants cannot be enrolled." },
        { status: 400 },
      );
    }

    let enrollment;
    try {
      enrollment = await db.assessmentTenantEnrollment.upsert({
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

  let job;
  try {
    job = await db.assessmentUnenrollJob.create({
      data: {
        assessmentId,
        targetScope: "TENANT",
        targetId: tenantId,
        effectiveAt,
        reportMode,
        notifyByEmail: Boolean(body?.notifyByEmail),
        linkTtlHours: body?.linkTtlHours && body.linkTtlHours > 0 ? body.linkTtlHours : null,
        createdByAdminId: check.session.user.id,
        status: "PENDING",
      },
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
    execution = await runDueUnenrollJobs({ forceJobId: job.id });
  }

  return NextResponse.json({ ok: true, action, job, execution });
}
