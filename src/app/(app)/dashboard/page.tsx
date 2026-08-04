import Link from "next/link";
import { getLiveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import {
  hasParticipantWorkspaceAccess,
  type WorkspaceRole,
} from "@/lib/workspace-navigation";

function roleLabel(role: WorkspaceRole) {
  if (role === "ADMIN") return "Admin";
  if (role === "LEADER") return "Leader";
  return "Participant";
}

export default async function DashboardPage() {
  const check = await getLiveSession();
  if (!check) {
    return null;
  }

  const { liveUser } = check;
  const role = liveUser.role as WorkspaceRole;
  const hasParticipantAccess = hasParticipantWorkspaceAccess(role);

  const [mySubmittedCount, publishedAssessments] = await Promise.all([
    hasParticipantAccess
      ? db.quizSession.count({
          where: {
            userId: liveUser.id,
            status: "SUBMITTED",
          },
        })
      : Promise.resolve(0),
    hasParticipantAccess
      ? db.assessment
          .count({
            where: {
              isPublished: true,
              OR: [
                {
                  userEnrollments: {
                    some: {
                      userId: liveUser.id,
                      active: true,
                    },
                  },
                },
                {
                  tenantEnrollments: {
                    some: {
                      tenantId: liveUser.tenantId,
                      active: true,
                      OR: [
                        { includeFutureUsers: true },
                        { createdAt: { gte: liveUser.createdAt } },
                      ],
                    },
                  },
                },
              ],
            },
          })
          .catch(async (error) => {
            if (!isSchemaCompatibilityError(error)) throw error;
            return db.assessment.count({
              where: {
                tenantId: liveUser.tenantId,
                isPublished: true,
              },
            });
          })
      : Promise.resolve(0),
  ]);

  const fullName =
    `${liveUser.firstName || ""} ${liveUser.lastName || ""}`.trim() ||
    liveUser.email ||
    roleLabel(role);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
      <section className="section-frame glass-panel rounded-[2rem] p-8 shadow-[0_24px_64px_-34px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">OLQLAB Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Welcome back, {fullName}</h1>
            <p className="mt-2 text-sm text-slate-600">{liveUser.email}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
            {roleLabel(role)}
          </span>
        </div>

        <div className={`mt-6 grid gap-3 sm:grid-cols-2 ${hasParticipantAccess ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
          {hasParticipantAccess && (
            <>
              <div className="metric-card rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Published Assessments</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{publishedAssessments}</p>
              </div>
              <div className="metric-card rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Completed By You</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{mySubmittedCount}</p>
              </div>
            </>
          )}
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{roleLabel(role)}</p>
          </div>
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Organisation</p>
            <p className="mt-2 truncate text-sm font-semibold text-slate-900">
              {liveUser.tenant.name || liveUser.tenantId || "-"}
            </p>
          </div>
        </div>
      </section>

      <section
        className={`grid gap-4 ${
          role === "LEADER" ? "md:grid-cols-2 lg:grid-cols-3" : hasParticipantAccess ? "md:grid-cols-2" : ""
        }`}
      >
        {hasParticipantAccess && (
          <>
            <Link
              href="/assessment/current"
              className="hover-lift rounded-2xl border border-slate-200 bg-white/88 p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Participant</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Assessment Center</h2>
              <p className="mt-2 text-sm text-slate-600">Start pending assessments and resume in-progress attempts.</p>
            </Link>

            <Link
              href="/reports/current"
              className="hover-lift rounded-2xl border border-slate-200 bg-white/88 p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Participant</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">My Reports</h2>
              <p className="mt-2 text-sm text-slate-600">Open completed reports and download PDF copies.</p>
            </Link>
          </>
        )}

        {role === "LEADER" && (
          <Link
            href="/reports/team"
            className="hover-lift rounded-2xl border border-cyan-200 bg-cyan-50/90 p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Team</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Team Reports</h2>
            <p className="mt-2 text-sm text-slate-700">
              Review submitted reports for participants in your organisation.
            </p>
          </Link>
        )}

        {role === "ADMIN" && (
          <Link
            href="/admin"
            className="hover-lift rounded-2xl border border-cyan-200 bg-cyan-50/90 p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Operations</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Admin Console</h2>
            <p className="mt-2 text-sm text-slate-700">
              Manage companies, users, assessments, completion tracking, and policy rules.
            </p>
          </Link>
        )}
      </section>
    </main>
  );
}
