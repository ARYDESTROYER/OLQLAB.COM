import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { lookupReportShareToken } from "@/lib/unenroll-jobs";
import { evaluateReportRelease } from "@/lib/report-release";
import {
  parseReportNarrative,
  resolveCanonicalReportHtml,
} from "@/lib/report-content";
import {
  reportShareGrantCookieName,
  verifyReportShareGrant,
} from "@/lib/report-share-grant";

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
    return NextResponse.json(
      { error: "Invalid or expired link." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  const tokenRow = await lookupReportShareToken(token);
  if (!tokenRow) {
    return NextResponse.json(
      { error: "Invalid or expired link." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const report = await db.report.findUnique({
    where: { id: tokenRow.reportId },
    include: { pdfAsset: { select: { id: true } } },
  });
  if (
    !report ||
    report.assessmentId !== tokenRow.assessmentId ||
    report.userId !== tokenRow.userId
  ) {
    return NextResponse.json(
      { error: "Report not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
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
    return NextResponse.json(
      { error: "Report not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
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
      { status: decision.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const participantName =
    `${tokenRow.user.firstName} ${tokenRow.user.lastName}`.trim() || "Participant";
  const narrative = policy.reportWorkflow === "AI_STANDARD"
    ? parseReportNarrative(report.narrativeJson)
    : null;
  if (policy.reportWorkflow === "AI_STANDARD" && !narrative) {
    return NextResponse.json({ error: "Report content is unavailable." }, { status: 500 });
  }

  return NextResponse.json(
    {
      assessment: { title: tokenRow.assessment.title },
      participant: { displayName: participantName },
      submittedAt: session.submittedAt,
      reportWorkflow: policy.reportWorkflow,
      canonicalHtml:
        policy.reportWorkflow === "AI_STANDARD" && narrative
          ? resolveCanonicalReportHtml(narrative, {
              assessmentTitle: tokenRow.assessment.title,
              participantName,
            })
          : null,
      shareLink: {
        expiresAt: tokenRow.expiresAt,
        remainingDownloads: Math.max(
          tokenRow.maxDownloads - tokenRow.downloadsUsed,
          0,
        ),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
