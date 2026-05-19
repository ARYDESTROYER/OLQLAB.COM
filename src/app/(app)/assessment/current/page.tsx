import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMissingTableError } from "@/lib/prisma-errors";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

type UiStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "RETAKE";

function chipTone(status: UiStatus): "brass" | "warn" | "default" {
  if (status === "SUBMITTED") return "brass";
  if (status === "IN_PROGRESS") return "warn";
  if (status === "RETAKE") return "warn";
  return "default";
}

function statusLabel(status: UiStatus) {
  if (status === "SUBMITTED") return "Completed";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "RETAKE") return "Retake available";
  return "Not started";
}

export default async function CurrentAssessmentPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/signin");

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      tenantId: true,
      createdAt: true,
      tenant: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!currentUser) redirect("/signin");

  await runDueUnenrollJobs({ userId: currentUser.id });

  const assessments = await db.assessment
    .findMany({
      where: {
        isPublished: true,
        OR: [
          {
            userEnrollments: {
              some: {
                userId: currentUser.id,
                active: true,
              },
            },
          },
          {
            tenantEnrollments: {
              some: {
                tenantId: currentUser.tenantId,
                active: true,
              },
            },
          },
        ],
      },
      include: {
        questions: {
          select: { id: true },
        },
        userEnrollments: {
          where: {
            userId: currentUser.id,
            active: true,
          },
          select: {
            id: true,
          },
        },
        tenantEnrollments: {
          where: {
            tenantId: currentUser.tenantId,
            active: true,
          },
          select: {
            id: true,
            includeFutureUsers: true,
            createdAt: true,
          },
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
          isPublished: true,
          OR: [
            {
              userEnrollments: {
                some: {
                  userId: currentUser.id,
                  active: true,
                },
              },
            },
            {
              tenantEnrollments: {
                some: {
                  tenantId: currentUser.tenantId,
                  active: true,
                },
              },
            },
          ],
        },
        include: {
          questions: {
            select: { id: true },
          },
          userEnrollments: {
            where: {
              userId: currentUser.id,
              active: true,
            },
            select: {
              id: true,
            },
          },
          tenantEnrollments: {
            where: {
              tenantId: currentUser.tenantId,
              active: true,
            },
            select: {
              id: true,
              includeFutureUsers: true,
              createdAt: true,
            },
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

  const eligibleAssessments = assessments.filter((assessment) => {
    const hasDirectEnrollment = assessment.userEnrollments.length > 0;
    const hasTenantEnrollment = assessment.tenantEnrollments.some(
      (enrollment) =>
        enrollment.includeFutureUsers || currentUser.createdAt <= enrollment.createdAt,
    );
    return hasDirectEnrollment || hasTenantEnrollment;
  });

  const tenantLabel = currentUser.tenant?.name || currentUser.tenantId;

  return (
    <main className="mx-auto max-w-7xl px-6 pt-12 pb-24 md:px-10 md:pt-16 md:pb-32">
      <section>
        <p className="inline-flex items-center text-[11px] font-medium uppercase tracking-[0.28em] text-[#101114]/55">
          <span className="brass-dot" aria-hidden /> Assessment hub
        </p>
        <h1 className="font-display mt-8 text-balance text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.03em]">
          Assessment Center<span className="brass-period">.</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#101114]/64 md:text-base">
          Start and continue assessments where you have active access.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            href="/dashboard"
            className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
          >
            Dashboard
          </Link>
          <Link
            href="/reports/current"
            className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
          >
            My Reports
          </Link>
        </div>
      </section>

      {eligibleAssessments.length === 0 ? (
        <section className="mt-[var(--workspace-section-y)] border-t border-[#101114]/15 pt-12">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#B5803C]">
            No active access
          </p>
          <h2 className="font-display mt-4 text-[clamp(1.5rem,3vw,2rem)] leading-tight tracking-tight text-[#101114]">
            Nothing assigned right now.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#101114]/68">
            You currently have no published assessments assigned from your organisation ({tenantLabel}).
          </p>
        </section>
      ) : (
        <section
          aria-label="Assessments"
          className="mt-[var(--workspace-section-y)] border-t border-[#101114]/22"
        >
          {eligibleAssessments.map((assessment, idx) => {
            const mySession = assessment.sessions[0] || null;
            const myRetestEligibility = assessment.retestEligibilities[0] || null;
            const rawStatus = mySession?.status || "NOT_STARTED";
            const retestAvailableNow =
              rawStatus === "SUBMITTED" &&
              Boolean(myRetestEligibility) &&
              new Date() >= myRetestEligibility.eligibleAt;

            const uiStatus: UiStatus = retestAvailableNow
              ? "RETAKE"
              : rawStatus === "SUBMITTED"
                ? "SUBMITTED"
                : rawStatus === "IN_PROGRESS"
                  ? "IN_PROGRESS"
                  : "NOT_STARTED";

            const actionHref = retestAvailableNow
              ? `/assessment/${assessment.id}`
              : rawStatus === "SUBMITTED"
                ? `/reports/me/${assessment.id}`
                : `/assessment/${assessment.id}`;
            const actionLabel = retestAvailableNow
              ? "Retake assessment"
              : rawStatus === "SUBMITTED"
                ? "View report"
                : rawStatus === "IN_PROGRESS"
                  ? "Resume"
                  : "Start";

            return (
              <article
                key={assessment.id}
                className="grid gap-x-10 gap-y-6 border-b border-[#101114]/12 py-[var(--workspace-row-y)] md:grid-cols-[auto_1fr_auto] md:items-start md:py-8"
              >
                <div className="flex items-center gap-4 md:flex-col md:items-start md:gap-2">
                  <span className="font-display text-2xl tracking-tight text-[#B5803C] md:text-3xl">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="workspace-chip" data-tone={chipTone(uiStatus) === "default" ? undefined : chipTone(uiStatus)}>
                    {statusLabel(uiStatus)}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
                    Assessment
                  </p>
                  <h2 className="font-display mt-2 text-[clamp(1.5rem,2.6vw,1.875rem)] leading-tight tracking-tight text-[#101114]">
                    {assessment.title}
                  </h2>
                  <p className="mt-2 text-sm text-[#101114]/64">
                    {assessment.questions.length} questions
                  </p>
                  {uiStatus === "IN_PROGRESS" && mySession?.startedAt && (
                    <p className="mt-2 text-xs text-[#101114]/60">
                      Started {mySession.startedAt.toLocaleString()}
                    </p>
                  )}
                  {rawStatus === "SUBMITTED" && mySession?.submittedAt && (
                    <p className="mt-2 text-xs text-[#101114]/60">
                      Submitted {mySession.submittedAt.toLocaleString()}
                    </p>
                  )}
                  {rawStatus === "SUBMITTED" && myRetestEligibility && !retestAvailableNow && (
                    <p className="mt-2 text-xs text-[#B5803C]">
                      Retake unlocks {myRetestEligibility.eligibleAt.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 md:flex-col md:items-end md:gap-3">
                  <Link href={actionHref} className="workspace-btn-primary">
                    <span>{actionLabel}</span>
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
