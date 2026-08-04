import Link from "next/link";
import { redirect } from "next/navigation";
import { getLiveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { resolveAssessmentAccessMany } from "@/lib/assessment-access";
import { evaluateReportRelease } from "@/lib/report-release";

export default async function CurrentReportsPage() {
  const check = await getLiveSession();
  if (!check) redirect("/signin");
  const userId = check.liveUser.id;

  const [reports, reportRows] = await Promise.all([
    db.quizSession.findMany({
      where: {
        userId,
        status: "SUBMITTED",
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
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
      orderBy: { submittedAt: "desc" },
    }),
    db.report.findMany({
      where: { userId },
      select: {
        assessmentId: true,
        status: true,
        availableAt: true,
        pdfAsset: { select: { id: true } },
      },
    }),
  ]);
  const accessByAssessmentId = await resolveAssessmentAccessMany(
    userId,
    reports.map((item) => item.assessment.id),
  );
  const accessResults = reports.map((item) => ({
    item,
    access: accessByAssessmentId.get(item.assessment.id),
  }));
  const reportByAssessmentId = new Map(
    reportRows.map((report) => [report.assessmentId, report]),
  );

  const visibleReports = accessResults
    .filter((entry) => {
      if (!entry.access?.canViewAppReport) return false;
      const report = reportByAssessmentId.get(entry.item.assessment.id) || null;
      const policy = entry.item.assessment.policy || {
        reportWorkflow: "AI_STANDARD" as const,
        showResultsToEmployee: true,
        resultReleaseDelayHours: 0,
        leaderCanViewFullReport: true,
      };
      return evaluateReportRelease({
        audience: "SELF",
        report: report
          ? {
              status: report.status,
              availableAt: report.availableAt,
              hasManualPdf: Boolean(report.pdfAsset),
            }
          : null,
        policy,
        submittedAt: entry.item.submittedAt,
      }).ready;
    })
    .map((entry) => entry.item);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="rounded-3xl border border-slate-200 bg-white/88 p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Report Hub</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">My Reports</h1>
        <p className="mt-2 text-sm text-slate-700">
          This page only lists completed assessments where app access is currently allowed.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Dashboard
          </Link>
          <Link
            href="/assessment/current"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Assessment Center
          </Link>
        </div>
      </header>

      {visibleReports.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No app-visible reports yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Complete an assessment or ask your admin to restore app report access.
          </p>
          <Link
            href="/assessment/current"
            className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Go to Assessment Center
          </Link>
        </section>
      ) : (
        <section className="space-y-4">
          {visibleReports.map((item) => {
            return (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Report</p>
                    <h2 className="text-lg font-semibold text-slate-900">{item.assessment.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Submitted: {item.submittedAt ? item.submittedAt.toLocaleString() : "-"}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    Completed
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/reports/me/${item.assessment.id}`}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    View Report
                  </Link>
                  <a
                    href={`/api/reports/me/${item.assessment.id}/pdf`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Download PDF
                  </a>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
