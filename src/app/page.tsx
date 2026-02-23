import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

const valueCards = [
  {
    title: "Self-awareness that creates action",
    text: "Participants receive clear trait signals, scenario behavior insights, and practical next-step coaching instead of generic labels.",
  },
  {
    title: "Leader-ready visibility",
    text: "Admins and leaders see completion, in-progress, and no-start users fast so development programs never go dark.",
  },
  {
    title: "Built for coaching, not judgment",
    text: "OLQLAB assessments are development-focused with no right/wrong framing, so people answer honestly and learn faster.",
  },
];

const flowSteps = [
  {
    step: "01",
    title: "Invite and enroll participants",
    text: "Add individuals or upload CSV. Every participant gets a secure magic-link login path.",
  },
  {
    step: "02",
    title: "Complete the assessment",
    text: "Participants answer a guided mix of personality and workplace-scenario questions.",
  },
  {
    step: "03",
    title: "Generate rich report outputs",
    text: "OLQLAB computes trait trends, competency deltas, strengths, and development priorities automatically.",
  },
  {
    step: "04",
    title: "Review with leaders",
    text: "Use role-based views and policy controls to share the right level of detail with each stakeholder.",
  },
  {
    step: "05",
    title: "Drive growth loops",
    text: "Turn insights into weekly coaching actions, track completion and rerun assessments as teams evolve.",
  },
];

const focusAreas = [
  {
    label: "Well-being",
    description:
      "Understand how stress response, emotional regulation, and confidence patterns affect day-to-day performance.",
  },
  {
    label: "Personal development",
    description:
      "Build targeted growth plans using your strongest levers for learning, execution, and communication.",
  },
  {
    label: "Relationships",
    description:
      "Improve collaboration by seeing where interaction styles align, differ, and create predictable friction.",
  },
];

const faqItems = [
  {
    q: "Is this a pass/fail test?",
    a: "No. OLQLAB is developmental. There are no right or wrong answers, and results are designed for growth conversations.",
  },
  {
    q: "How long does it take?",
    a: "Most participants complete the assessment in one focused sitting. Teams can customize depth based on program goals.",
  },
  {
    q: "Can leaders see individual reports?",
    a: "Yes, but only when admin policy allows it. Visibility, delay windows, and release controls are configurable per assessment.",
  },
  {
    q: "Is the platform suitable for single users too?",
    a: "Yes. OLQLAB supports both corporate team onboarding and solo-buyer flows.",
  },
];

function roleLabel(role: Role) {
  if (role === "ADMIN") return "Admin";
  if (role === "LEADER") return "Leader";
  return "Participant";
}

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return (
      <main className="relative overflow-hidden pb-24">
        <div className="pointer-events-none absolute inset-x-0 -top-56 h-[520px] bg-[radial-gradient(ellipse_at_top,#99f6e4_0%,rgba(153,246,228,0)_58%)] animate-aurora-one" />
        <div className="pointer-events-none absolute -right-20 top-24 h-[420px] w-[420px] rounded-full bg-amber-200/45 blur-3xl animate-aurora-two" />
        <div className="pointer-events-none absolute -left-24 bottom-16 h-[360px] w-[360px] rounded-full bg-sky-300/30 blur-3xl animate-aurora-three" />

        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">OQ</div>
              <div>
                <p className="text-sm font-semibold tracking-[0.14em] text-slate-900">OLQLAB</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Personality Intelligence</p>
              </div>
            </div>

            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
              <a href="#how-it-works" className="transition hover:text-slate-900">How it works</a>
              <a href="#reports" className="transition hover:text-slate-900">Reports</a>
              <a href="#science" className="transition hover:text-slate-900">Why OLQLAB</a>
              <a href="#faq" className="transition hover:text-slate-900">FAQ</a>
            </nav>

            <Link
              href="/signin"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
            >
              Sign In
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-6 pt-12 md:px-10 md:pt-16">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="surface-fade rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-[0_30px_70px_-35px_rgba(15,23,42,0.55)] backdrop-blur-xl md:p-12">
              <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                Built for corporate development programs
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
                The professional way to assess personality and workstyle at scale.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-700 md:text-lg">
                OLQLAB helps organizations understand how people think, collaborate, adapt, and grow. Combine
                personality signals with realistic workplace scenarios to get insights leaders can actually use.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signin"
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
                >
                  Start with Magic Link
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-500"
                >
                  Explore Platform
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Assessment model</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Trait + Scenario Hybrid</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Built for</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Teams, Leaders, HR</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Output quality</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Action-ready reports</p>
                </div>
              </div>
            </article>

            <aside className="surface-fade-delay grid gap-4 rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Immediate outcomes</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>Clear strengths and blind spots</li>
                  <li>Behavioral coaching direction</li>
                  <li>Faster manager 1:1 prep</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Admin confidence</p>
                <p className="mt-2 text-sm text-slate-700">
                  Invite-only access, role-based controls, policy-based report release, and completion tracking.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Participant experience</p>
                <p className="mt-2 text-sm text-slate-700">
                  Friendly, simple flow focused on reflection and growth instead of evaluation anxiety.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl px-6 md:px-10">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="scroll-reveal rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm hover-lift">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Designed for speed</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">Minutes to launch</p>
            </div>
            <div className="scroll-reveal rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm hover-lift">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Participant value</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">Detailed personal insight</p>
            </div>
            <div className="scroll-reveal rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm hover-lift">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Leader value</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">Coaching-ready context</p>
            </div>
            <div className="scroll-reveal rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm hover-lift">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Admin value</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">Full completion visibility</p>
            </div>
          </div>
        </section>

        <section id="science" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal rounded-[2rem] border border-slate-200 bg-white/85 p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Why organizations choose OLQLAB</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Built on practical psychology principles, delivered in a modern team workflow.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {valueCards.map((card) => (
                <article key={card.title} className="hover-lift rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{card.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal rounded-[2rem] border border-slate-200 bg-white/90 p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              From invitation to measurable development, in five clean steps.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {flowSteps.map((item) => (
                <article key={item.step} className="hover-lift rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Step {item.step}</p>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="reports" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal grid gap-6 rounded-[2rem] border border-slate-200 bg-white/90 p-7 md:grid-cols-[1.1fr_0.9fr] md:p-10">
            <article>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Report intelligence</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Insights that are clear enough for participants and deep enough for leaders.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-700">
                Every completed assessment generates a structured report with trait signals, scenario competency
                outcomes, growth opportunities, and actionable coaching suggestions. Export professional PDF reports for
                sessions, reviews, and follow-through.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Participant report</p>
                  <p className="mt-2 text-sm text-slate-700">Strengths, growth focus, weekly action prompts, and self-awareness summary.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Leader report</p>
                  <p className="mt-2 text-sm text-slate-700">Manager coaching context, behavior patterns, and targeted support guidance.</p>
                </div>
              </div>
            </article>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Sample trait snapshot</p>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Openness", value: 78 },
                  { label: "Conscientiousness", value: 71 },
                  { label: "Extraversion", value: 63 },
                  { label: "Agreeableness", value: 74 },
                  { label: "Emotional Stability", value: 58 },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-xs text-slate-600">
                      <span>{row.label}</span>
                      <span>{row.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-slate-900" style={{ width: `${row.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal rounded-[2rem] border border-slate-200 bg-white/90 p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Impact zones</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Use personality intelligence where it matters most.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {focusAreas.map((area) => (
                <article key={area.label} className="hover-lift rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{area.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{area.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal rounded-[2rem] border border-slate-200 bg-white/90 p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Common questions before you launch.
            </h2>
            <div className="mt-8 grid gap-3">
              {faqItems.map((item) => (
                <details key={item.q} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">{item.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal rounded-[2rem] border border-slate-900 bg-slate-900 p-8 text-white md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Ready to launch OLQLAB?</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Turn personality insight into measurable development outcomes.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
              Start with your first cohort, deploy in minutes, and give participants and leaders the clarity they need
              for better communication, stronger collaboration, and sustainable growth.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/signin"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
              >
                Open OLQLAB Workspace
              </Link>
            </div>
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
