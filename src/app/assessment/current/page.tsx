import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function CurrentAssessmentPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) redirect("/signin");

  const assessments = await db.assessment.findMany({
    where: {
      tenantId: session.user.tenantId,
      isPublished: true,
    },
    include: {
      questions: {
        select: { id: true },
      },
      sessions: {
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          submittedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="rounded-3xl bg-gradient-to-r from-cyan-100 via-sky-50 to-amber-100 p-7">
        <h1 className="text-3xl font-semibold tracking-tight">Assessment Center</h1>
        <p className="mt-2 text-sm text-slate-700">
          Start your assigned assessments and review completed reports.
        </p>
      </header>

      {assessments.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">No published assessments yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your organization has not published an assessment for your account yet.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {assessments.map((assessment) => {
            const mySession = assessment.sessions[0] || null;
            const status = mySession?.status || "NOT_STARTED";
            const statusLabel =
              status === "SUBMITTED"
                ? "Completed"
                : status === "IN_PROGRESS"
                  ? "In Progress"
                  : "Not Started";

            const actionHref =
              status === "SUBMITTED"
                ? `/reports/me/${assessment.id}`
                : `/assessment/${assessment.id}`;
            const actionLabel =
              status === "SUBMITTED"
                ? "View Report"
                : status === "IN_PROGRESS"
                  ? "Resume"
                  : "Start";

            return (
              <article
                key={assessment.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{assessment.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{assessment.questions.length} questions</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      status === "SUBMITTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : status === "IN_PROGRESS"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={actionHref}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    {actionLabel}
                  </Link>
                  {status === "IN_PROGRESS" && mySession?.startedAt && (
                    <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                      Started: {mySession.startedAt.toLocaleString()}
                    </p>
                  )}
                  {status === "SUBMITTED" && mySession?.submittedAt && (
                    <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                      Submitted: {mySession.submittedAt.toLocaleString()}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
