import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireLeaderOrAdmin } from "@/lib/api-auth";
import { evaluateReportRelease } from "@/lib/report-release";
import { isAssessmentParticipantRole } from "@/lib/assessment-access";
import {
  parseReportNarrative,
  resolveCanonicalReportText,
} from "@/lib/report-content";
import {
  isReportPdfInputLimitError,
  renderCanonicalReportPdf,
} from "@/lib/report-pdf";

function headers(fileName: string) {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

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
  if (
    check.liveUser.role === "LEADER" &&
    (employee.tenantId !== check.liveUser.tenantId || employee.managerId !== check.liveUser.id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [assessment, report, session] = await Promise.all([
    db.assessment.findUnique({
      where: { id: assessmentId },
      select: { title: true, policy: true },
    }),
    db.report.findUnique({
      where: { assessmentId_userId: { assessmentId, userId } },
      include: { pdfAsset: { select: { fileName: true, pdfBytes: true } } },
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
    showResultsToEmployee: true,
    resultReleaseDelayHours: 0,
    leaderCanViewFullReport: true,
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
      { status: decision.status },
    );
  }

  if (policy.reportWorkflow === "MANUAL_PDF_UPLOAD" && report?.pdfAsset) {
    return new NextResponse(new Uint8Array(report.pdfAsset.pdfBytes), {
      headers: headers(report.pdfAsset.fileName || `olq-report-${assessmentId}.pdf`),
    });
  }

  const narrative = report ? parseReportNarrative(report.narrativeJson) : null;
  if (!narrative) {
    return NextResponse.json({ error: "Report content is unavailable." }, { status: 500 });
  }
  const participantName =
    `${employee.firstName} ${employee.lastName}`.trim() || "Participant";
  let bytes: Uint8Array;
  try {
    bytes = await renderCanonicalReportPdf({
      assessmentTitle: assessment.title,
      participantName,
      submittedAt: session.submittedAt,
      canonicalText: resolveCanonicalReportText(narrative, {
        assessmentTitle: assessment.title,
        participantName,
      }),
    });
  } catch (error) {
    if (!isReportPdfInputLimitError(error)) throw error;
    return NextResponse.json({ error: error.message }, { status: 413 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: headers(`olq-report-${assessmentId}.pdf`),
  });
}
