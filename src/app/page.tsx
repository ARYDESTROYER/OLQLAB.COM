import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

function roleLabel(role: Role) {
  if (role === "ADMIN") return "Admin";
  if (role === "LEADER") return "Leader";
  return "Participant";
}

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return (
      <main className="relative overflow-hidden px-6 pb-20 pt-10 md:px-10 md:pt-12">
        <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl animate-float-slow" />
        <div className="pointer-events-none absolute right-[-80px] top-[-40px] h-96 w-96 rounded-full bg-amber-200/50 blur-3xl animate-float-medium" />
        <div className="pointer-events-none absolute bottom-[-120px] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-200/45 blur-3xl animate-float-slow" />

        <section className="mx-auto max-w-7xl space-y-8">
          <header className="surface-fade flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 px-5 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">OQ</div>
              <div>
                <p className="text-sm font-semibold tracking-[0.12em] text-slate-900">OLQLAB</p>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Workstyle Intelligence</p>
              </div>
            </div>
            <Link
              href="/signin"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Sign In
            </Link>
          </header>

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="surface-fade-delay rounded-[2rem] border border-slate-200 bg-white/80 p-7 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl md:p-10">
              <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                OLQLAB Personality Intelligence Platform
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
                Build stronger teams with clear personality and behavior signals.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-700 md:text-lg">
                OLQLAB combines trait-based psychometrics and workplace scenarios into one professional assessment
                workflow, with rich reports for participants, leaders, and HR decision-makers.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signin"
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
                >
                  Start With Magic Link
                </Link>
                <Link
                  href="/signin"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-500"
                >
                  Open Workspace
                </Link>
              </div>
            </article>

            <aside className="surface-fade-delay-2 grid gap-4 rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl md:p-7">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Assessment Design</p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  Hybrid personality + scenario model with role-based access controls.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Admin Visibility</p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  Track completion, in-progress users, and no-shows in one console.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Reporting</p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  Action-ready participant reports and downloadable PDF summaries.
                </p>
              </div>
            </aside>
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">OLQLAB Workspace</p>
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
          href="/reports/current"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400"
        >
          <h2 className="text-lg font-semibold text-slate-900">My Reports</h2>
          <p className="mt-2 text-sm text-slate-600">Open completed reports and download PDF copies.</p>
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
