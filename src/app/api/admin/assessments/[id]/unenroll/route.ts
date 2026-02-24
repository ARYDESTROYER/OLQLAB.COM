import { NextRequest, NextResponse } from "next/server";
import { ReportAccessMode } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

type UnenrollBody = {
  scope?: "USER" | "TENANT";
  targetId?: string;
  effectiveAt?: string;
  reportMode?: "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE";
  notifyByEmail?: boolean;
  linkTtlHours?: number;
  dryRun?: boolean;
};

async function resolveImpactedUsers(
  scope: "USER" | "TENANT",
  targetId: string,
) {
  if (scope === "USER") {
    return db.user.findMany({
      where: {
        id: targetId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }

  return db.user.findMany({
    where: {
      tenantId: targetId,
      role: { in: ["EMPLOYEE", "LEADER"] },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });
}

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
    select: { id: true, title: true },
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
      return NextResponse.json({ error: "Target tenant not found." }, { status: 404 });
    }
  }

  const impactedUsers = await resolveImpactedUsers(scope, targetId);

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
        targetScope: scope,
        targetId,
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

  return NextResponse.json({
    ok: true,
    job,
    execution,
  });
}
