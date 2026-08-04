import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  releaseReportShareTokenDownloadReservation,
  reserveReportShareTokenDownload,
  revalidateReportShareTokenDownloadReservation,
} from "@/lib/unenroll-jobs";
import { evaluateReportRelease } from "@/lib/report-release";
import {
  parseReportNarrative,
  resolveCanonicalReportText,
} from "@/lib/report-content";
import {
  isReportPdfInputLimitError,
  renderCanonicalReportPdf,
} from "@/lib/report-pdf";
import {
  reportShareGrantCookieName,
  verifyReportShareGrant,
} from "@/lib/report-share-grant";

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
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cookieStore = await cookies();
  if (
    !verifyReportShareGrant({
      token,
      value: cookieStore.get(reportShareGrantCookieName(token))?.value,
      secret: getEnv().NEXTAUTH_SECRET,
    })
  ) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }
  // Reserve the bounded slot before loading report bytes or running the PDF
  // renderer. Parallel requests therefore cannot amplify expensive work after
  // the final available slot has already been claimed.
  const tokenRow = await reserveReportShareTokenDownload(token);
  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }

  let downloadCommitted = false;
  try {
    const report = await db.report.findUnique({
      where: { id: tokenRow.reportId },
      include: {
        pdfAsset: { select: { id: true, fileName: true, pdfBytes: true } },
      },
    });
    if (
      !report ||
      report.assessmentId !== tokenRow.assessmentId ||
      report.userId !== tokenRow.userId
    ) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }
    const session = await db.quizSession.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: report.assessmentId,
          userId: report.userId,
        },
      },
      select: { status: true, submittedAt: true },
    });
    if (!session || session.status !== "SUBMITTED") {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const policy = tokenRow.assessment.policy || {
      reportWorkflow: "AI_STANDARD" as const,
      showResultsToEmployee: true,
      resultReleaseDelayHours: 0,
      leaderCanViewFullReport: true,
    };
    const decision = evaluateReportRelease({
      audience: "SHARED",
      report: {
        status: report.status,
        availableAt: report.availableAt,
        hasManualPdf: Boolean(report.pdfAsset),
      },
      policy,
      submittedAt: session.submittedAt,
    });
    if (!decision.ready) {
      return NextResponse.json(
        { error: decision.message, code: decision.code },
        { status: decision.status },
      );
    }

    let bytes: Buffer;
    let fileName: string;
    if (policy.reportWorkflow === "MANUAL_PDF_UPLOAD" && report.pdfAsset) {
      bytes = Buffer.from(report.pdfAsset.pdfBytes);
      fileName = report.pdfAsset.fileName || `olq-report-${tokenRow.assessmentId}.pdf`;
    } else {
      const narrative = parseReportNarrative(report.narrativeJson);
      if (!narrative) {
        return NextResponse.json(
          { error: "Report content is unavailable." },
          { status: 500 },
        );
      }
      const participantName =
        `${tokenRow.user.firstName} ${tokenRow.user.lastName}`.trim() || "Participant";
      const canonicalText = resolveCanonicalReportText(narrative, {
        assessmentTitle: tokenRow.assessment.title,
        participantName,
      });
      try {
        bytes = Buffer.from(
          await renderCanonicalReportPdf({
            assessmentTitle: tokenRow.assessment.title,
            participantName,
            submittedAt: session.submittedAt,
            canonicalText,
          }),
        );
      } catch (error) {
        if (!isReportPdfInputLimitError(error)) throw error;
        return NextResponse.json({ error: error.message }, { status: 413 });
      }
      fileName = `olq-report-${tokenRow.assessmentId}.pdf`;
    }

    // Rendering may be slow enough for an administrator to revoke the token,
    // replace the report attempt, or change release/access policy. Re-read the
    // cheap authorization state immediately before returning private bytes.
    const [finalReport, finalSession] = await Promise.all([
      db.report.findUnique({
        where: { id: tokenRow.reportId },
        select: {
          assessmentId: true,
          userId: true,
          status: true,
          availableAt: true,
          updatedAt: true,
          pdfAsset: { select: { id: true } },
          assessment: {
            select: {
              policy: {
                select: {
                  reportWorkflow: true,
                  showResultsToEmployee: true,
                  resultReleaseDelayHours: true,
                  leaderCanViewFullReport: true,
                },
              },
            },
          },
        },
      }),
      db.quizSession.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId: tokenRow.assessmentId,
            userId: tokenRow.userId,
          },
        },
        select: { status: true, submittedAt: true },
      }),
    ]);
    const finalPolicy = finalReport?.assessment.policy || policy;
    const finalBindingValid = Boolean(
      finalReport &&
        finalReport.assessmentId === tokenRow.assessmentId &&
        finalReport.userId === tokenRow.userId &&
        finalReport.updatedAt.getTime() === report.updatedAt.getTime() &&
        (policy.reportWorkflow !== "MANUAL_PDF_UPLOAD" ||
          finalReport.pdfAsset?.id === report.pdfAsset?.id),
    );
    const finalDecision = evaluateReportRelease({
      audience: "SHARED",
      report:
        finalBindingValid && finalReport
          ? {
              status: finalReport.status,
              availableAt: finalReport.availableAt,
              hasManualPdf: Boolean(finalReport.pdfAsset),
            }
          : null,
      policy: finalPolicy,
      submittedAt:
        finalSession?.status === "SUBMITTED" ? finalSession.submittedAt : null,
    });
    const grantStillValid = verifyReportShareGrant({
      token,
      value: cookieStore.get(reportShareGrantCookieName(token))?.value,
      secret: getEnv().NEXTAUTH_SECRET,
    });
    const reservationStillValid =
      finalBindingValid &&
      finalSession?.status === "SUBMITTED" &&
      finalDecision.ready &&
      grantStillValid &&
      (await revalidateReportShareTokenDownloadReservation({
        tokenId: tokenRow.id,
        reportId: tokenRow.reportId,
      }));
    if (!reservationStillValid) {
      return NextResponse.json(
        { error: "Invalid or expired link." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const response = new NextResponse(new Uint8Array(bytes), {
      headers: headers(fileName),
    });
    downloadCommitted = true;
    return response;
  } finally {
    if (!downloadCommitted) {
      try {
        await releaseReportShareTokenDownloadReservation(tokenRow.id);
      } catch (error) {
        // Conservatively leave the slot reserved if cleanup itself fails; a
        // later request must never overrun the configured download ceiling.
        console.error("Failed to release report download reservation.", error);
      }
    }
  }
}
