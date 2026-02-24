import Link from "next/link";
import { redirect } from "next/navigation";
import { addHours } from "date-fns";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function CurrentReportsPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/signin");

  const reports = await db.quizSession.findMany({
    where: {
      userId: session.user.id,
      status: "SUBMITTED",
    },
    include: {
      assessment: {
        select: {
          id: true,
          title: true,
          policy: {
            select: {
              showResultsToEmployee: true,
              resultReleaseDelayHours: true,
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="rounded-3xl border border-slate-200 bg-white/88 p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Report Hub</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">My Reports</h1>
        <p className="mt-2 text-sm text-slate-700">
          This page only lists completed assessments and report downloads.
        </p>
      </header>

      {reports.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No reports yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Complete at least one assessment to generate your report.
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
          {reports.map((item) => {
            const delayHours = item.assessment.policy?.resultReleaseDelayHours || 0;
            const showResults = item.assessment.policy?.showResultsToEmployee ?? true;
            const releaseAt =
              item.submittedAt && delayHours > 0
                ? addHours(item.submittedAt, delayHours)
                : item.submittedAt;
            const isReleased = showResults && (!releaseAt || new Date() >= releaseAt);

            return (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Report</p>
                    <h2 className="text-lg font-semibold text-slate-900">{item.assessment.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Submitted: {item.submittedAt ? item.submittedAt.toLocaleString() : "-"}
                    </p>
                    {!showResults && (
                      <p className="mt-1 text-xs text-amber-700">
                        Result visibility is disabled by your organization.
                      </p>
                    )}
                    {showResults && releaseAt && !isReleased && (
                      <p className="mt-1 text-xs text-amber-700">
                        Report unlocks at: {releaseAt.toLocaleString()}
                      </p>
                    )}
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
                    className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                      isReleased
                        ? "border-slate-300 bg-white text-slate-700"
                        : "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                    }`}
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
