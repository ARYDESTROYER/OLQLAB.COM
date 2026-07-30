import type { Metadata } from "next";
import Image from "next/image";
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

export const metadata: Metadata = {
  title: "Secure leadership report | OLQ Lab",
  robots: { index: false, follow: false, nocache: true },
};

function unavailable(message: string) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Report unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

function activationLanding(token: string, unavailableLink: boolean) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Image
          src="/logo.png"
          alt="OLQ Lab"
          width={48}
          height={48}
          className="mx-auto rounded-full"
        />
        <h1 className="mt-5 text-2xl font-semibold text-slate-900">
          Secure leadership report
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {unavailableLink
            ? "This secure link is unavailable. Ask the sender for a new report link."
            : "To protect private report content from automated email scanners, confirm below before opening it."}
        </p>
        {!unavailableLink ? (
          <form
            method="post"
            action={`/api/reports/shared/${encodeURIComponent(token)}/activate`}
            className="mt-6"
          >
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Open secure report
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

export default async function SharedReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ unavailable?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const hasGrant = verifyReportShareGrant({
    token,
    value: cookieStore.get(reportShareGrantCookieName(token))?.value,
    secret: getEnv().NEXTAUTH_SECRET,
  });
  if (!hasGrant) return activationLanding(token, query.unavailable === "1");

  const tokenRow = await lookupReportShareToken(token);
  if (!tokenRow) {
    return unavailable(
      "This secure link has expired, been revoked, or reached its download limit.",
    );
  }

  const report = await db.report.findUnique({
    where: { id: tokenRow.reportId },
    include: { pdfAsset: { select: { id: true, fileName: true } } },
  });
  if (
    !report ||
    report.assessmentId !== tokenRow.assessmentId ||
    report.userId !== tokenRow.userId
  ) {
    return unavailable("The report linked here no longer exists.");
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
    return unavailable("The report linked here no longer exists.");
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
  if (!decision.ready) return unavailable(decision.message);

  const participantName =
    `${tokenRow.user.firstName} ${tokenRow.user.lastName}`.trim() || "Participant";
  const isManual = policy.reportWorkflow === "MANUAL_PDF_UPLOAD";
  const narrative = !isManual ? parseReportNarrative(report.narrativeJson) : null;
  if (!isManual && !narrative) return unavailable("Report content is unavailable.");
  const canonicalHtml = !isManual && narrative
    ? resolveCanonicalReportHtml(narrative, {
        assessmentTitle: tokenRow.assessment.title,
        participantName,
      })
    : "";

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="OLQ Lab"
              width={36}
              height={36}
              className="rounded-full"
            />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{tokenRow.assessment.title}</h1>
              <p className="truncate text-xs text-slate-500">Prepared for {participantName}</p>
            </div>
          </div>
          <a href={`/api/reports/shared/${encodeURIComponent(token)}/pdf`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Download PDF</a>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 md:py-10">
        <section className="min-h-[28rem] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 md:p-12">
          {isManual ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
              <h2 className="text-xl font-semibold text-slate-900">PDF report</h2>
              <p className="mt-2 text-sm text-slate-600">Use the download button to open this administrator-reviewed report.</p>
              {report?.pdfAsset?.fileName ? <p className="mt-2 text-xs text-slate-500">File: {report.pdfAsset.fileName}</p> : null}
            </div>
          ) : canonicalHtml ? (
            <article className="report-document" dangerouslySetInnerHTML={{ __html: canonicalHtml }} />
          ) : (
            <p className="text-slate-600">Report content is unavailable.</p>
          )}
        </section>
      </div>
    </main>
  );
}
