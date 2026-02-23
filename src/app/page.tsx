import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

function roleLabel(role: Role) {
  if (role === "ADMIN") return "Platform Admin";
  if (role === "LEADER") return "Team Leader";
  return "Participant";
}

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-6xl space-y-12 px-6 py-10 md:px-10 md:py-16">
        <section className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-sm md:grid-cols-[1.2fr_0.8fr] md:p-12">
          <div className="space-y-6">
            <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Personality Intelligence Platform
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Professional personality assessments for modern teams.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-700">
              PersonaPilot combines validated trait items with real workplace scenarios to produce actionable,
              development-focused reports for participants, leaders, and HR teams.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signin"
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Sign In With Magic Link
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">How It Works</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
              <li>Admins onboard clients and participants.</li>
              <li>Participants complete a mixed personality + scenario assessment.</li>
              <li>Reports provide strengths, growth areas, and coaching actions.</li>
              <li>Leaders track completion and development progress.</li>
            </ol>
          </div>
        </section>
      </main>
    );
  }

  const [publishedAssessments, mySubmittedCount, userRecord] = await Promise.all([
    db.assessment.count({
      where: {
        tenantId: session.user.tenantId,
        isPublished: true,
      },
    }),
    db.quizSession.count({
      where: {
        userId: session.user.id,
        status: "SUBMITTED",
      },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        tenant: {
          select: { name: true },
        },
      },
    }),
  ]);

  const role = session.user.role as Role;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-600">{session.user.email}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
            {roleLabel(role)}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Published Assessments</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{publishedAssessments}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Completed By You</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{mySubmittedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{roleLabel(role)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tenant</p>
            <p className="mt-2 truncate text-sm font-semibold text-slate-900">
              {userRecord?.tenant?.name || session.user.tenantId || "-"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/assessment/current"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400"
        >
          <h2 className="text-lg font-semibold text-slate-900">Assessment Center</h2>
          <p className="mt-2 text-sm text-slate-600">Start pending assessments and resume in-progress attempts.</p>
        </Link>

        <Link
          href="/assessment/current"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400"
        >
          <h2 className="text-lg font-semibold text-slate-900">My Reports</h2>
          <p className="mt-2 text-sm text-slate-600">Access your latest submitted assessments and downloadable reports.</p>
        </Link>

        {role === "ADMIN" && (
          <Link
            href="/admin"
            className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400"
          >
            <h2 className="text-lg font-semibold text-slate-900">Admin Console</h2>
            <p className="mt-2 text-sm text-slate-700">
              Manage companies, users, assessments, completion tracking, and reporting policy.
            </p>
          </Link>
        )}
      </section>
    </main>
  );
}
