import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { evaluateReportRelease } from "@/lib/report-release";
import {
  parseReportNarrative,
  resolveCanonicalReportText,
} from "@/lib/report-content";
import {
  isReportPdfInputLimitError,
  renderCanonicalReportPdf,
} from "@/lib/report-pdf";

function pdfHeaders(fileName: string) {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { assessmentId } = await params;
  const userId = check.session.user.id;

  const access = await resolveAssessmentAccess(userId, assessmentId);
  if (!access.canViewAppReport) {
    return NextResponse.json(
      {
        error: access.canViewViaLinkOnly
          ? "Use the secure report link sent by email."
          : "Report access has been revoked.",
      },
      { status: 403 },
    );
  }

  const [session, report] = await Promise.all([
    db.quizSession.findUnique({
      where: { assessmentId_userId: { assessmentId, userId } },
      include: {
        assessment: { select: { title: true, policy: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    db.report.findUnique({
      where: { assessmentId_userId: { assessmentId, userId } },
      include: {
        pdfAsset: {
          select: { fileName: true, mimeType: true, pdfBytes: true },
        },
      },
    }),
  ]);
  if (!session || session.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Submitted report not found." }, { status: 404 });
  }

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
  if (!decision.ready) {
    return NextResponse.json(
      { error: decision.message, code: decision.code },
      { status: decision.status },
    );
  }

  if (policy.reportWorkflow === "MANUAL_PDF_UPLOAD" && report?.pdfAsset) {
    return new NextResponse(new Uint8Array(report.pdfAsset.pdfBytes), {
      headers: pdfHeaders(report.pdfAsset.fileName || `olq-report-${assessmentId}.pdf`),
    });
  }

  const narrative = report ? parseReportNarrative(report.narrativeJson) : null;
  if (!narrative) {
    return NextResponse.json({ error: "Report content is unavailable." }, { status: 500 });
  }
  const participantName =
    `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant";
  const canonicalText = resolveCanonicalReportText(narrative, {
    assessmentTitle: session.assessment.title,
    participantName,
  });
  let bytes: Uint8Array;
  try {
    bytes = await renderCanonicalReportPdf({
      assessmentTitle: session.assessment.title,
      participantName,
      submittedAt: session.submittedAt,
      canonicalText,
    });
  } catch (error) {
    if (!isReportPdfInputLimitError(error)) throw error;
    return NextResponse.json({ error: error.message }, { status: 413 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: pdfHeaders(`olq-report-${assessmentId}.pdf`),
  });
}
