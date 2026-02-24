import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

const leadershipPillars = [
  {
    title: "Transformational leadership development",
    text: "Personalized coaching grounded in behavioral science to strengthen clarity, confidence, and decision quality.",
  },
  {
    title: "Building teams that flourish",
    text: "Inclusive leadership patterns that improve trust, collaboration, and consistent team execution.",
  },
  {
    title: "Strategic talent and succession planning",
    text: "Behavior intelligence to identify emerging leaders and build stronger leadership pipelines.",
  },
];

const cprDimensions = [
  {
    title: "Cognitive",
    subtitle: "How You Think",
    description:
      "How you process complexity, spot patterns, and make strategic decisions when information is incomplete.",
  },
  {
    title: "Personality",
    subtitle: "How You Engage",
    description:
      "How you build trust, influence stakeholders, and shape the quality of relationships across the organization.",
  },
  {
    title: "Response",
    subtitle: "How You Adapt",
    description:
      "How you stay effective under pressure, recover from setbacks, and adapt behavior in changing conditions.",
  },
];

const founderExpertise = [
  "Culture Diagnostic",
  "Leadership Blindspot Coaching",
  "Organizational Development",
  "Behavioral Analysis",
  "Executive Coaching",
  "Talent Management",
];

const programTracks = [
  {
    name: "Leadership Diagnostic",
    duration: "4-6 weeks",
    summary:
      "For executive and senior manager cohorts. Establishes behavior baselines and high-leverage interventions.",
  },
  {
    name: "Manager Capability Program",
    duration: "6-10 weeks",
    summary:
      "For managers and team leads. Combines individual reports with structured coaching actions and follow-through checks.",
  },
  {
    name: "Enterprise Team Baseline",
    duration: "8-12 weeks",
    summary:
      "For cross-functional organizations. Provides consistent behavioral measurement at scale for culture and performance planning.",
  },
];

const transformationJourney = [
  {
    stage: "Awareness",
    description:
      "Assessment reveals your CPR profile, strengths, growth areas, and patterns that shape your leadership behavior.",
  },
  {
    stage: "Understanding",
    description:
      "Coaching sessions deepen insight into why patterns repeat, where blindspots appear, and how to shift effectively.",
  },
  {
    stage: "Integration",
    description:
      "Leaders turn insight into concrete actions that improve communication, resilience, and team outcomes.",
  },
  {
    stage: "Mastery",
    description:
      "Progress is sustained through follow-through, reflection, and leadership habits that scale across teams.",
  },
];

const valueMetrics = [
  {
    value: "40",
    label: "curated assessment items",
    note: "Hybrid personality and workplace-scenario model.",
  },
  {
    value: "8",
    label: "workplace competency axes",
    note: "From emotional intelligence to accountability and collaboration.",
  },
  {
    value: "5",
    label: "trait dimensions",
    note: "Big Five profile translated into coaching-ready language.",
  },
];

const benefits = [
  "Self-clarity and reduced blindspots",
  "Stronger manager-participant coaching conversations",
  "Resilience and adaptability under pressure",
  "Authentic leadership impact across teams",
  "Program-level visibility for CHRO and L&D",
  "Practical action plans with measurable follow-through",
];

const faqItems = [
  {
    q: "Is OLQLAB software access or a managed assessment program?",
    a: "OLQLAB is sold as a managed corporate assessment and development program delivered with your leadership and HR teams.",
  },
  {
    q: "Is this a pass/fail test?",
    a: "No. It is a developmental behavioral assessment focused on leadership effectiveness and growth.",
  },
  {
    q: "Can report visibility be controlled?",
    a: "Yes. Admin policy controls who can view reports, release timing, and leader-level access.",
  },
  {
    q: "What do decision makers receive?",
    a: "Consolidated strengths, risk zones, behavior themes, and coaching priorities at participant and cohort levels.",
  },
];

const tickerItems = [
  "Leadership readiness",
  "Manager effectiveness",
  "Behavior intelligence",
  "Blindspot clarity",
  "Team collaboration",
  "Retention insights",
  "Culture development",
  "Coaching actions",
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
      <main className="relative overflow-hidden pb-28">
        <div className="ambient-orb animate-aurora-one -top-40 left-[-140px] h-[460px] w-[460px] bg-cyan-300/60" />
        <div className="ambient-orb animate-aurora-two -right-24 top-24 h-[420px] w-[420px] bg-amber-200/70" />
        <div className="ambient-orb animate-aurora-three bottom-14 left-1/3 h-[360px] w-[360px] bg-emerald-200/45" />

        <header className="sticky top-0 z-40 border-b border-slate-200/75 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
            <div className="flex items-center gap-3">
              <div className="gradient-ring flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                OQ
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.14em] text-slate-900">OLQLAB</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Leadership Intelligence Program</p>
              </div>
            </div>

            <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
              <a href="#model" className="transition hover:text-slate-900">Model</a>
              <a href="#program" className="transition hover:text-slate-900">Program</a>
              <a href="#journey" className="transition hover:text-slate-900">Journey</a>
              <a href="#faq" className="transition hover:text-slate-900">FAQ</a>
            </nav>

            <div className="flex items-center gap-2">
              <a
                href="#contact"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
              >
                Book Consultation
              </a>
              <Link
                href="/signin"
                className="hidden rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 md:inline-block"
              >
                Client Sign In
              </Link>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-6 pt-12 md:px-10 md:pt-16">
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="section-frame glass-panel rounded-[2rem] p-8 shadow-[0_36px_80px_-40px_rgba(15,23,42,0.62)] md:p-12">
              <div className="hero-noise rounded-[inherit]" />

              <p className="hero-chip">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
                Leadership is a journey within
              </p>

              <h1 className="font-display mt-7 text-5xl leading-[0.92] text-slate-900 md:text-7xl">
                Lead with clarity, compassion, and behavioral intelligence.
              </h1>

              <p className="mt-7 max-w-2xl text-base leading-relaxed text-slate-700 md:text-lg">
                OLQLAB blends deep leadership reflection with enterprise-grade assessment delivery. We combine the
                soft wisdom of coaching with structured measurement so CHROs, managers, and participants all move from
                insight to action.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/signin"
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
                >
                  Start With OLQLAB
                </Link>
                <a
                  href="#journey"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-500"
                >
                  See Transformation Journey
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="metric-card rounded-xl p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Founder</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Cmdr. (Dr.) Pratap Pawar</p>
                </div>
                <div className="metric-card rounded-xl p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Buyer profile</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">CHRO, L&D, HRBP</p>
                </div>
                <div className="metric-card rounded-xl p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Delivery mode</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Managed by OLQLAB</p>
                </div>
              </div>
            </article>

            <aside className="relative space-y-4">
              <article className="section-frame glass-panel rounded-[2rem] p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.48)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Program Snapshot</p>
                <h2 className="font-display mt-3 text-3xl leading-tight text-slate-900">What your organization gets</h2>

                <div className="mt-6 space-y-3">
                  {valueMetrics.map((metric) => (
                    <div key={metric.label} className="feature-card rounded-xl p-4">
                      <p className="metric-value">{metric.value}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{metric.label}</p>
                      <p className="mt-1 text-sm text-slate-700">{metric.note}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="section-frame data-grid glass-panel rounded-[2rem] p-6 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.38)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Founder Perspective</p>
                <blockquote className="mt-3 border-l-2 border-cyan-300 pl-4 text-sm leading-relaxed text-slate-700">
                  &ldquo;Leadership is not about being the loudest voice. It is about understanding people deeply,
                  including yourself, and making decisions with courage and care.&rdquo;
                </blockquote>
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">Cmdr. (Dr.) Pratap Pawar</p>
              </article>
            </aside>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl px-6 md:px-10">
          <div className="section-frame glass-panel rounded-2xl p-3">
            <div className="ticker">
              <div className="ticker-track">
                {[...tickerItems, ...tickerItems].map((item, idx) => (
                  <span key={`${item}-${idx}`} className="ticker-pill">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Leadership Development</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Human-centered guidance backed by enterprise rigor.
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {leadershipPillars.map((pillar) => (
                <article key={pillar.title} className="hover-lift-strong feature-card rounded-2xl p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="model" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">CPR Framework</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              The three dimensions that shape leadership behavior.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700 md:text-base">
              OLQLAB applies the Composite Pattern Recognition model to evaluate thinking, engagement, and adaptability
              together, so leaders are not reduced to one-dimensional labels.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {cprDimensions.map((dimension) => (
                <article key={dimension.title} className="hover-lift feature-card rounded-2xl p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{dimension.title}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800">{dimension.subtitle}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{dimension.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="program" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Program Tracks</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Engagement models matched to your organizational scope.
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {programTracks.map((track) => (
                <article key={track.name} className="hover-lift-strong feature-card rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{track.duration}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{track.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{track.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Founder Expertise</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Military-tested discipline, corporate-ready leadership coaching.
            </h2>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-slate-700 md:text-base">
              Commander (Dr.) Pratap Pawar brings 35 years of leadership experience spanning Indian Navy operations,
              behavioral psychology, and multinational people strategy transformation.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {founderExpertise.map((item) => (
                <article key={item} className="hover-lift rounded-xl border border-slate-200 bg-white/82 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="journey" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Transformation Journey</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Four stages from insight to sustained leadership change.
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {transformationJourney.map((item, idx) => (
                <article key={item.stage} className="hover-lift rounded-2xl border border-slate-200 bg-white/82 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Stage {idx + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.stage}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What Awaits You</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Business outcomes and personal leadership growth, together.
            </h2>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {benefits.map((item) => (
                <article key={item} className="hover-lift rounded-xl border border-slate-200 bg-white/82 p-4">
                  <p className="text-sm leading-relaxed text-slate-700">{item}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Questions HR and procurement leaders usually ask.
            </h2>
            <div className="mt-8 grid gap-3">
              {faqItems.map((item) => (
                <details key={item.q} className="rounded-xl border border-slate-200 bg-white/80 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">{item.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="cta-panel relative overflow-hidden rounded-[2rem] p-8 text-white md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Enterprise consultation</p>
            <h2 className="font-display mt-3 max-w-4xl text-4xl leading-tight md:text-6xl">
              Begin your leadership transformation with OLQLAB.
            </h2>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">
              Share your team size, goals, and timeline. We will recommend the right assessment track, reporting
              model, and delivery cadence for your organization.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="mailto:hello@olqlab.com?subject=OLQLAB%20Enterprise%20Consultation"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
              >
                Contact OLQLAB Sales
              </a>
              <Link
                href="/signin"
                className="rounded-xl border border-slate-500 bg-slate-800/80 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Existing Client Sign In
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
      <section className="section-frame glass-panel rounded-[2rem] p-8 shadow-[0_24px_64px_-34px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">OLQLAB Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-600">{session.user.email}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
            {roleLabel(role)}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Published Assessments</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{publishedAssessments}</p>
          </div>
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Completed By You</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{mySubmittedCount}</p>
          </div>
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{roleLabel(role)}</p>
          </div>
          <div className="metric-card rounded-xl p-4">
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
