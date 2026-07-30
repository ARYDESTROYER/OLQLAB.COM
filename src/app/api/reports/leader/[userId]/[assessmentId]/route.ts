import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireLeaderOrAdmin } from "@/lib/api-auth";
import { evaluateReportRelease } from "@/lib/report-release";
import { isAssessmentParticipantRole } from "@/lib/assessment-access";
import {
  parseReportNarrative,
  resolveCanonicalReportHtml,
} from "@/lib/report-content";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string; assessmentId: string }> },
) {
  const check = await requireLeaderOrAdmin();
  if ("error" in check) return check.error;
  const { userId, assessmentId } = await params;

  const employee = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      tenantId: true,
      managerId: true,
      role: true,
    },
  });
  if (!employee || !isAssessmentParticipantRole(employee.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (check.liveUser.role === "LEADER") {
    const sameTenant = employee.tenantId === check.liveUser.tenantId;
    const isManager = employee.managerId === check.liveUser.id;
    if (!sameTenant || !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [assessment, report, session] = await Promise.all([
    db.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, title: true, policy: true },
    }),
    db.report.findUnique({
      where: { assessmentId_userId: { assessmentId, userId } },
      include: { pdfAsset: { select: { id: true } } },
    }),
    db.quizSession.findUnique({
      where: { assessmentId_userId: { assessmentId, userId } },
      select: { status: true, submittedAt: true },
    }),
  ]);
  if (!assessment || !session || session.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Submitted report not found." }, { status: 404 });
  }

  const policy = assessment.policy || {
    reportWorkflow: "AI_STANDARD" as const,
    leaderCanViewFullReport: true,
    showResultsToEmployee: true,
    resultReleaseDelayHours: 0,
  };
  const decision = evaluateReportRelease({
    audience: "LEADER",
    report: report
      ? {
          status: report.status,
          availableAt: report.availableAt,
          hasManualPdf: Boolean(report.pdfAsset),
        }
      : null,
    policy,
    submittedAt: session.submittedAt,
  });
  if (!decision.ready) {
    return NextResponse.json(
      { error: decision.message, code: decision.code },
      { status: decision.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const participantName =
    `${employee.firstName} ${employee.lastName}`.trim() || "Participant";
  const narrative = policy.reportWorkflow === "AI_STANDARD" && report
    ? parseReportNarrative(report.narrativeJson)
    : null;
  if (policy.reportWorkflow === "AI_STANDARD" && !narrative) {
    return NextResponse.json({ error: "Report content is unavailable." }, { status: 500 });
  }

  return NextResponse.json(
    {
      employee: { firstName: employee.firstName, lastName: employee.lastName },
      assessment: { id: assessment.id, title: assessment.title },
      submittedAt: session.submittedAt,
      reportWorkflow: policy.reportWorkflow,
      manualPdfReady: Boolean(report?.pdfAsset),
      canonicalHtml:
        policy.reportWorkflow === "AI_STANDARD" && narrative
          ? resolveCanonicalReportHtml(narrative, {
              assessmentTitle: assessment.title,
              participantName,
            })
          : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
