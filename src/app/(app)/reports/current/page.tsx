import Link from "next/link";
import { redirect } from "next/navigation";
import { addHours } from "date-fns";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

export default async function CurrentReportsPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/signin");

  await runDueUnenrollJobs({ userId: session.user.id });

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

  const accessResults = await Promise.all(
    reports.map(async (item) => {
      const access = await resolveAssessmentAccess(session.user.id, item.assessment.id);
      return {
        item,
        access,
      };
    }),
  );

  const publishedReports = await db.report.findMany({
    where: {
      userId: session.user.id,
      status: "PUBLISHED",
      OR: [{ availableAt: null }, { availableAt: { lte: new Date() } }],
    },
    select: {
      assessmentId: true,
    },
  });
  const publishedAssessmentIds = new Set(publishedReports.map((report) => report.assessmentId));

  const visibleReports = accessResults
    .filter(
      (entry) => entry.access.canViewAppReport && publishedAssessmentIds.has(entry.item.assessment.id),
    )
    .map((entry) => entry.item);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-12 pb-24 md:px-10 md:pt-16 md:pb-32">
      <section>
        <p className="inline-flex items-center text-[11px] font-medium uppercase tracking-[0.28em] text-[#101114]/55">
          <span className="brass-dot" aria-hidden /> Report hub
        </p>
        <h1 className="font-display mt-8 text-balance text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.03em]">
          My reports<span className="brass-period">.</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#101114]/64 md:text-base">
          Completed assessments where app access is currently allowed. Reports for archived
          access still live in shared link form if you have one.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            href="/dashboard"
            className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
          >
            Dashboard
          </Link>
          <Link
            href="/assessment/current"
            className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
          >
            Assessment Center
          </Link>
        </div>
      </section>

      {visibleReports.length === 0 ? (
        <section className="mt-[var(--workspace-section-y)] border-t border-[#101114]/15 pt-12">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#B5803C]">
            Nothing yet
          </p>
          <h2 className="font-display mt-4 text-[clamp(1.5rem,3vw,2rem)] leading-tight tracking-tight text-[#101114]">
            No app-visible reports.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#101114]/68">
            Complete an assessment or ask your admin to restore app report access.
          </p>
          <Link
            href="/assessment/current"
            className="workspace-btn-primary mt-8"
          >
            <span>Go to Assessment Center</span>
            <span aria-hidden>→</span>
          </Link>
        </section>
      ) : (
        <section
          aria-label="Completed reports"
          className="mt-[var(--workspace-section-y)] border-t border-[#101114]/22"
        >
          {visibleReports.map((item, idx) => {
            const delayHours = item.assessment.policy?.resultReleaseDelayHours || 0;
            const showResults = item.assessment.policy?.showResultsToEmployee ?? true;
            const releaseAt =
              item.submittedAt && delayHours > 0
                ? addHours(item.submittedAt, delayHours)
                : item.submittedAt;
            const isReleased = showResults && (!releaseAt || new Date() >= releaseAt);

            return (
              <article
                key={item.id}
                className="grid gap-x-10 gap-y-6 border-b border-[#101114]/12 py-[var(--workspace-row-y)] md:grid-cols-[auto_1fr_auto] md:items-start md:py-8"
              >
                <div className="flex items-center gap-4 md:flex-col md:items-start md:gap-2">
                  <span className="font-display text-2xl tracking-tight text-[#B5803C] md:text-3xl">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="workspace-chip" data-tone="brass">
                    Completed
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
                    Report
                  </p>
                  <h2 className="font-display mt-2 text-[clamp(1.5rem,2.6vw,1.875rem)] leading-tight tracking-tight text-[#101114]">
                    {item.assessment.title}
                  </h2>
                  <p className="mt-2 text-sm text-[#101114]/64">
                    Submitted {item.submittedAt ? item.submittedAt.toLocaleString() : "—"}
                  </p>
                  {!showResults && (
                    <p className="mt-2 text-xs text-[#B5803C]">
                      Result visibility is disabled by your organisation.
                    </p>
                  )}
                  {showResults && releaseAt && !isReleased && (
                    <p className="mt-2 text-xs text-[#B5803C]">
                      Report unlocks at {releaseAt.toLocaleString()}.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 md:flex-col md:items-end md:gap-3">
                  <Link
                    href={`/reports/me/${item.assessment.id}`}
                    className="workspace-btn-primary"
                  >
                    <span>View report</span>
                    <span aria-hidden>→</span>
                  </Link>
                  <a
                    href={`/api/reports/me/${item.assessment.id}/pdf`}
                    className={
                      isReleased
                        ? "workspace-btn-secondary"
                        : "workspace-btn-secondary pointer-events-none opacity-50"
                    }
                  >
                    <span>Download PDF</span>
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
