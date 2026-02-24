import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMissingTableError } from "@/lib/prisma-errors";

export default async function CurrentAssessmentPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/signin");

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      tenantId: true,
      tenant: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!currentUser?.tenantId) redirect("/signin");

  const seat = await db.seat.findUnique({
    where: {
      tenantId_userEmail: {
        tenantId: currentUser.tenantId,
        userEmail: currentUser.email.toLowerCase(),
      },
    },
    select: {
      id: true,
      assigned: true,
    },
  });

  const assessments = await db.assessment
    .findMany({
      where: {
        tenantId: currentUser.tenantId,
        isPublished: true,
      },
      include: {
        questions: {
          select: { id: true },
        },
        sessions: {
          where: {
            userId: currentUser.id,
          },
          select: {
            id: true,
            status: true,
            startedAt: true,
            submittedAt: true,
          },
        },
        retestEligibilities: {
          where: {
            userId: currentUser.id,
          },
          select: {
            eligibleAt: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    })
    .catch(async (error) => {
      if (!isMissingTableError(error, "retesteligibility")) throw error;

      const fallbackAssessments = await db.assessment.findMany({
        where: {
          tenantId: currentUser.tenantId,
          isPublished: true,
        },
        include: {
          questions: {
            select: { id: true },
          },
          sessions: {
            where: {
              userId: currentUser.id,
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

      return fallbackAssessments.map((assessment) => ({
        ...assessment,
        retestEligibilities: [] as Array<{ eligibleAt: Date }>,
      }));
    });

  const tenantLabel = currentUser.tenant?.name || currentUser.tenantId;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="rounded-3xl border border-cyan-200 bg-cyan-50/80 p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Assessment Hub</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Assessment Center</h1>
        <p className="mt-2 text-sm text-slate-700">
          Start and continue assigned assessments from this page.
        </p>
      </header>

      {!seat ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Account access is out of sync</h2>
          <p className="mt-2 text-sm text-amber-900">
            Your seat assignment for <span className="font-semibold">{tenantLabel}</span> is missing.
            Ask your admin to re-add you from the selected assessment or re-send your invite.
          </p>
        </section>
      ) : assessments.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No published assessments yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            No published assessments were found for <span className="font-semibold">{tenantLabel}</span>.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {assessments.map((assessment) => {
            const mySession = assessment.sessions[0] || null;
            const myRetestEligibility = assessment.retestEligibilities[0] || null;
            const status = mySession?.status || "NOT_STARTED";
            const retestAvailableNow =
              status === "SUBMITTED" &&
              Boolean(myRetestEligibility) &&
              new Date() >= myRetestEligibility.eligibleAt;
            const statusLabel =
              retestAvailableNow
                ? "Retake Available"
                : status === "SUBMITTED"
                ? "Completed"
                : status === "IN_PROGRESS"
                  ? "In Progress"
                  : "Not Started";

            const actionHref =
              retestAvailableNow
                ? `/assessment/${assessment.id}`
                : status === "SUBMITTED"
                ? `/reports/me/${assessment.id}`
                : `/assessment/${assessment.id}`;
            const actionLabel =
              retestAvailableNow
                ? "Retake Assessment"
                : status === "SUBMITTED"
                ? "View Report"
                : status === "IN_PROGRESS"
                  ? "Resume"
                  : "Start";

            return (
              <article
                key={assessment.id}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Assessment</p>
                    <h2 className="text-lg font-semibold text-slate-900">{assessment.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{assessment.questions.length} questions</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      retestAvailableNow
                        ? "bg-cyan-100 text-cyan-800"
                        : status === "SUBMITTED"
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
                  {status === "SUBMITTED" &&
                    myRetestEligibility &&
                    !retestAvailableNow && (
                      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Retake unlocks: {myRetestEligibility.eligibleAt.toLocaleString()}
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
