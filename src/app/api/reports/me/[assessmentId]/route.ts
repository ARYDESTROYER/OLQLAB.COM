import { addHours } from "date-fns";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { assessmentId } = await params;

  await runDueUnenrollJobs({
    assessmentId,
    userId: check.session.user.id,
  });

  const session = await db.quizSession.findUnique({
    where: {
      assessmentId_userId: {
        assessmentId,
        userId: check.session.user.id,
      },
    },
    include: {
      assessment: { include: { policy: true } },
    },
  });

  if (!session || session.status !== "SUBMITTED") {
    return NextResponse.json({ error: "No submitted report" }, { status: 404 });
  }

  const access = await resolveAssessmentAccess(check.session.user.id, assessmentId);
  if (!access.canViewAppReport) {
    if (access.canViewViaLinkOnly) {
      return NextResponse.json({
        message:
          "App access to this report is disabled. Use your secure share link from email.",
      });
    }

    return NextResponse.json({
      message:
        "Your access to this report has been revoked by your administrator.",
    });
  }

  const policy = session.assessment.policy;
  const reportWorkflow = policy?.reportWorkflow || "AI_STANDARD";
  if (!policy?.showResultsToEmployee) {
    return NextResponse.json({
      message: "Your organization has chosen not to release individual results.",
      reportWorkflow,
      reportStatus: null,
    });
  }

  if (session.submittedAt) {
    const releaseAt = addHours(session.submittedAt, policy.resultReleaseDelayHours);
    if (new Date() < releaseAt) {
      return NextResponse.json({
        message: `Results will be available after ${releaseAt.toISOString()}.`,
        reportWorkflow,
        reportStatus: null,
      });
    }
  }

  const [score, report] = await Promise.all([
    db.score.findUnique({
      where: { assessmentId_userId: { assessmentId, userId: check.session.user.id } },
    }),
    db.report.findUnique({
      where: { assessmentId_userId: { assessmentId, userId: check.session.user.id } },
      include: {
        pdfAsset: {
          select: {
            id: true,
          },
        },
      },
    }),
  ]);

  if (!report) {
    if (reportWorkflow === "MANUAL_PDF_UPLOAD") {
      return NextResponse.json({
        message:
          "Assessment completed. Your report is under review. You will be notified once it is available.",
        reportWorkflow,
        reportStatus: "DRAFT",
        manualPdfReady: false,
      });
    }

    return NextResponse.json({ error: "No submitted report" }, { status: 404 });
  }

  if (report.status !== "PUBLISHED") {
    if (reportWorkflow === "MANUAL_PDF_UPLOAD") {
      return NextResponse.json({
        message:
          "Assessment completed. Your report is under review. You will be notified once it is available.",
        reportWorkflow,
        reportStatus: report.status,
        manualPdfReady: Boolean(report.pdfAsset),
      });
    }

    return NextResponse.json({
      message:
        "Your report is still under review and has not been published yet.",
      reportWorkflow,
      reportStatus: report.status,
    });
  }

  if (report.availableAt && new Date() < report.availableAt) {
    return NextResponse.json({
      message: `Your report will be available after ${report.availableAt.toISOString()}.`,
      reportWorkflow,
      reportStatus: report.status,
      manualPdfReady: Boolean(report.pdfAsset),
    });
  }

  if (reportWorkflow === "MANUAL_PDF_UPLOAD" && !report.pdfAsset) {
    return NextResponse.json({
      message:
        "Assessment completed. Your report is under review. You will be notified once it is available.",
      reportWorkflow,
      reportStatus: "DRAFT",
      manualPdfReady: false,
    });
  }

  return NextResponse.json({
    assessment: {
      id: session.assessment.id,
      title: session.assessment.title,
    },
    submittedAt: session.submittedAt,
    score,
    reportStatus: report.status,
    reportWorkflow,
    manualPdfReady: Boolean(report.pdfAsset),
    narrative: JSON.parse(report.narrativeJson),
  });
}
