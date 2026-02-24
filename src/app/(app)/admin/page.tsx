import Link from "next/link";
import { db } from "@/lib/db";
import { isMissingTableError } from "@/lib/prisma-errors";

export default async function AdminOverviewPage() {
  const [tenantCount, userCount, assessmentCount, sessionCount] = await Promise.all([
    db.tenant.count(),
    db.user.count(),
    db.assessment.count(),
    db.quizSession.count(),
  ]);

  let pendingJobs = 0;
  let recentJobs: Array<{
    id: string;
    assessmentId: string;
    targetScope: string;
    targetId: string;
    reportMode: string;
    status: string;
    effectiveAt: Date;
    assessment: { id: string; title: string };
  }> = [];

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

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tenants</p>
          <p className="mt-2 text-2xl font-semibold">{tenantCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Users</p>
          <p className="mt-2 text-2xl font-semibold">{userCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Assessments</p>
          <p className="mt-2 text-2xl font-semibold">{assessmentCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sessions</p>
          <p className="mt-2 text-2xl font-semibold">{sessionCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending Unenroll Jobs</p>
          <p className="mt-2 text-2xl font-semibold">{pendingJobs}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/users"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="mt-2 text-sm text-slate-600">
            Add, move, convert to solo, enroll directly, and inspect tests/access.
          </p>
        </Link>
        <Link
          href="/admin/tenants"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <h2 className="text-lg font-semibold">Tenants</h2>
          <p className="mt-2 text-sm text-slate-600">
            Manage organizations, seat limits, archive state, and tenant-level enrollments.
          </p>
        </Link>
        <Link
          href="/admin/assessments"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <h2 className="text-lg font-semibold">Assessments</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create global assessments, publish, assign access, and run unenroll workflows.
          </p>
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Recent Access Jobs</h2>
        {recentJobs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No jobs yet.</p>
        ) : (
          <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Assessment</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Effective At</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/assessments/${job.assessmentId}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {job.assessment.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{job.targetScope}</td>
                    <td className="px-3 py-2">{job.targetId}</td>
                    <td className="px-3 py-2">{job.reportMode}</td>
                    <td className="px-3 py-2">{job.status}</td>
                    <td className="px-3 py-2">{job.effectiveAt.toLocaleString()}</td>
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
