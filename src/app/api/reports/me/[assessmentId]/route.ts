import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import {
  parseReportNarrative,
  resolveCanonicalReportHtml,
} from "@/lib/report-content";
import { evaluateReportRelease } from "@/lib/report-release";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { assessmentId } = await params;
  const userId = check.session.user.id;

  const session = await db.quizSession.findUnique({
    where: { assessmentId_userId: { assessmentId, userId } },
    include: {
      assessment: { select: { id: true, title: true, policy: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (!session || session.status !== "SUBMITTED") {
    return NextResponse.json({ error: "No submitted report." }, { status: 404 });
  }

  const access = await resolveAssessmentAccess(userId, assessmentId);
  if (!access.canViewAppReport) {
    return NextResponse.json(
      {
        error: access.canViewViaLinkOnly
          ? "App access is disabled. Use the secure report link sent by email."
          : "Your report access has been revoked by your administrator.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const report = await db.report.findUnique({
    where: { assessmentId_userId: { assessmentId, userId } },
    include: { pdfAsset: { select: { id: true } } },
  });
  const policy = session.assessment.policy || {
    reportWorkflow: "AI_STANDARD" as const,
    showResultsToEmployee: true,
    resultReleaseDelayHours: 0,
    leaderCanViewFullReport: true,
  };
  const decision = evaluateReportRelease({
    audience: "SELF",
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

  const reportWorkflow = policy.reportWorkflow;
  if (!decision.ready) {
    const message =
      reportWorkflow === "MANUAL_PDF_UPLOAD" &&
      (decision.code === "REPORT_MISSING" ||
        decision.code === "REPORT_DRAFT" ||
        decision.code === "PDF_MISSING")
        ? "Assessment completed. Your report is under review. You will be notified once it is available."
        : decision.message;
    return NextResponse.json(
      {
        message,
        reportWorkflow,
        reportStatus: report?.status || null,
        manualPdfReady: Boolean(report?.pdfAsset),
        availableAt: decision.availableAt || null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const participantName =
    `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant";
  const narrative = reportWorkflow === "AI_STANDARD" && report
    ? parseReportNarrative(report.narrativeJson)
    : null;
  if (reportWorkflow === "AI_STANDARD" && !narrative) {
    return NextResponse.json({ error: "Report content is unavailable." }, { status: 500 });
  }

  return NextResponse.json(
    {
      assessment: { id: session.assessment.id, title: session.assessment.title },
      participantName,
      submittedAt: session.submittedAt,
      reportStatus: report?.status,
      reportWorkflow,
      manualPdfReady: Boolean(report?.pdfAsset),
      canonicalHtml:
        reportWorkflow === "AI_STANDARD" && narrative
          ? resolveCanonicalReportHtml(narrative, {
              assessmentTitle: session.assessment.title,
              participantName,
            })
          : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
