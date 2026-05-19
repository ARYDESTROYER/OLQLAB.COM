import Link from "next/link";
import { db } from "@/lib/db";
import { getAdminUserStats } from "@/lib/admin-user-stats";
import { isMissingTableError } from "@/lib/prisma-errors";

type RecentJob = {
  id: string;
  assessmentId: string;
  targetScope: string;
  targetId: string;
  reportMode: string;
  status: string;
  effectiveAt: Date;
  assessment: { id: string; title: string };
};

export default async function AdminOverviewPage() {
  const [tenantCount, userStats, assessmentCount, sessionCount] = await Promise.all([
    db.tenant.count(),
    getAdminUserStats(),
    db.assessment.count(),
    db.quizSession.count(),
  ]);

  let pendingJobs = 0;
  let recentJobs: RecentJob[] = [];

  try {
    [pendingJobs, recentJobs] = await Promise.all([
      db.assessmentUnenrollJob.count({
        where: {
          status: "PENDING",
        },
      }),
      db.assessmentUnenrollJob.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
    ]);
  } catch (error) {
    if (!isMissingTableError(error, "assessmentunenrolljob")) throw error;
    pendingJobs = 0;
    recentJobs = [];
  }

  const metrics: Array<{ label: string; value: string | number }> = [
    { label: "Organisations", value: tenantCount },
    { label: "Accounts total", value: userStats.usersTotal },
    { label: "Participants", value: userStats.usersParticipants },
    { label: "Admins", value: userStats.usersAdmins },
    { label: "Assessments", value: assessmentCount },
    { label: "Sessions", value: sessionCount },
    { label: "Pending jobs", value: pendingJobs },
  ];

  const quickLinks: Array<{
    href: string;
    numeral: string;
    eyebrow: string;
    title: string;
    body: string;
  }> = [
    {
      href: "/admin/users",
      numeral: "I",
      eyebrow: "People",
      title: "Users",
      body: "Add, move, convert to solo, enroll directly, and inspect tests and access.",
    },
    {
      href: "/admin/tenants",
      numeral: "II",
      eyebrow: "Structure",
      title: "Organisations",
      body: "Manage organisations, seat limits, archive state, and organisation-level enrollments.",
    },
    {
      href: "/admin/assessments",
      numeral: "III",
      eyebrow: "Library",
      title: "Assessments",
      body: "Create global assessments, publish, assign access, and run unenroll workflows.",
    },
  ];

  return (
    <div>
      <section
        aria-label="Workspace metrics"
        className="grid gap-y-8 border-y border-[#101114]/15 py-[var(--workspace-metric-py)] md:grid-cols-4 md:gap-x-10"
      >
        {metrics.map((metric, idx) => (
          <div
            key={metric.label}
            className={`flex flex-col gap-3 md:gap-4 ${
              idx > 0 && idx % 4 !== 0 ? "md:border-l md:border-[#101114]/10 md:pl-10" : ""
            }`}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
              {metric.label}
            </p>
            <p className="font-display truncate text-[clamp(2.25rem,4.5vw,3.5rem)] leading-none tracking-[-0.02em] text-[#101114]">
              {metric.value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-x-10 border-b border-[#101114]/15 pb-8 md:grid-cols-2 md:items-start">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
            User mix context
          </p>
        </div>
        <div>
          <p className="text-sm leading-relaxed text-[#101114]/72">
            {userStats.usersInSoloTenants} user
            {userStats.usersInSoloTenants === 1 ? "" : "s"} in solo organisations,{" "}
            {userStats.usersInArchivedTenants} user
            {userStats.usersInArchivedTenants === 1 ? "" : "s"} in archived organisations.
          </p>
        </div>
      </section>

      <section
        aria-label="Console quick links"
        className="mt-[var(--workspace-section-y)] grid gap-x-10 gap-y-12 md:grid-cols-3"
      >
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group block border-t border-[#101114]/15 pt-8 transition-colors duration-200 hover:border-[#B5803C]/55"
          >
            <p className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#B5803C]">
              <span className="font-display text-base normal-case tracking-tight text-[#B5803C]">
                {link.numeral}
              </span>
              <span>{link.eyebrow}</span>
            </p>
            <h2 className="font-display mt-4 text-[clamp(1.75rem,3.5vw,2.25rem)] leading-tight tracking-tight text-[#101114]">
              {link.title}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#101114]/68">
              {link.body}
            </p>
            <span className="link-underline mt-6 inline-flex items-center gap-3 text-sm font-medium text-[#101114]">
              Open
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-[var(--workspace-section-y)]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
            Activity
          </p>
          <h2 className="font-display text-[clamp(1.5rem,2.6vw,1.875rem)] leading-tight tracking-tight text-[#101114]">
            Recent access jobs
          </h2>
        </div>

        {recentJobs.length === 0 ? (
          <p className="mt-6 border-t border-[#101114]/15 pt-6 text-sm text-[#101114]/68">
            No jobs yet.
          </p>
        ) : (
          <div className="mt-6 overflow-auto">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Scope</th>
                  <th>Target</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Effective at</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link
                        href={`/admin/assessments/${job.assessmentId}`}
                        className="link-underline text-[#101114]"
                      >
                        {job.assessment.title}
                      </Link>
                    </td>
                    <td>{job.targetScope}</td>
                    <td className="font-mono text-xs text-[#101114]/64">{job.targetId}</td>
                    <td>{job.reportMode}</td>
                    <td>{job.status}</td>
                    <td>{job.effectiveAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
