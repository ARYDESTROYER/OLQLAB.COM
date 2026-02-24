import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

const buyerPillars = [
  {
    title: "Executive-grade behavior intelligence",
    text: "Map leadership and team behavior patterns with evidence your HR and business leaders can act on quickly.",
  },
  {
    title: "Managed program delivery",
    text: "OLQLAB operates the assessment journey with your stakeholders. You buy measurable outcomes, not setup overhead.",
  },
  {
    title: "Coaching-focused outputs",
    text: "Each participant and manager gets clear, practical guidance tied to strengths, risk zones, and development priorities.",
  },
];

const corporateUseCases = [
  {
    title: "Leadership bench readiness",
    text: "Clarify which leadership behaviors are scaling with the business and where intervention is needed.",
  },
  {
    title: "Manager capability uplift",
    text: "Develop managers using behavior-level insights that improve coaching quality and team consistency.",
  },
  {
    title: "Team effectiveness and collaboration",
    text: "Surface communication, ownership, and conflict patterns before they impact execution.",
  },
  {
    title: "Retention and culture development",
    text: "Identify pressure, engagement, and growth blockers to strengthen employee experience and stability.",
  },
];

const domainSignals = [
  {
    domain: "Self-awareness and reflection",
    signal: "How accurately people identify strengths, blind spots, and habitual responses.",
  },
  {
    domain: "Resilience under pressure",
    signal: "How people respond, adapt, and recover during high-demand periods.",
  },
  {
    domain: "Communication and influence",
    signal: "How ideas are conveyed, challenged, and aligned across teams.",
  },
  {
    domain: "Collaboration and accountability",
    signal: "How consistently individuals support shared goals while owning outcomes.",
  },
  {
    domain: "Learning and adaptability",
    signal: "How willing people are to absorb feedback and modify behavior.",
  },
  {
    domain: "Decision discipline",
    signal: "How choices balance speed, empathy, risk, and long-term impact.",
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

const rolloutJourney = [
  {
    step: "01",
    title: "Alignment",
    detail: "Define business outcomes, participant cohorts, and governance rules with CHRO/L&D stakeholders.",
  },
  {
    step: "02",
    title: "Program setup",
    detail: "Configure assessment policy, communication plan, and milestone cadence for your organization.",
  },
  {
    step: "03",
    title: "Assessment delivery",
    detail: "Participants complete the guided OLQLAB assessment with autosave and controlled access.",
  },
  {
    step: "04",
    title: "Insight synthesis",
    detail: "Scores, narratives, and behavior themes are consolidated into participant and leadership views.",
  },
  {
    step: "05",
    title: "Action deployment",
    detail: "Leaders receive practical coaching prompts, risk flags, and development priorities by cohort.",
  },
];

const stakeholderViews = [
  {
    role: "CHRO / L&D",
    points: [
      "Program-level completion and readiness visibility.",
      "Behavior trends by cohort and role segment.",
      "Priority development themes for leadership planning.",
    ],
  },
  {
    role: "People Leaders",
    points: [
      "Individual strengths and growth areas per participant.",
      "Manager coaching prompts tied to observed behavior patterns.",
      "Team-level insight for collaboration and delivery quality.",
    ],
  },
  {
    role: "Participants",
    points: [
      "Clear trait and competency profile without pass/fail framing.",
      "Actionable recommendations for role effectiveness.",
      "Structured reflection prompts and growth roadmap.",
    ],
  },
];

const faqItems = [
  {
    q: "Is OLQLAB software access or a managed assessment program?",
    a: "OLQLAB is sold as a corporate assessment and development program. We deliver the full journey with your team.",
  },
  {
    q: "Is this a pass/fail test?",
    a: "No. It is a developmental behavioral assessment designed to improve leadership and team effectiveness.",
  },
  {
    q: "Can report visibility be controlled?",
    a: "Yes. Admin policy controls who can access reports, when reports are released, and leader-view permissions.",
  },
  {
    q: "What do decision makers receive?",
    a: "A consolidated view of strengths, risk zones, and practical action levers at both participant and cohort level.",
  },
];

const tickerItems = [
  "Leadership readiness",
  "Manager effectiveness",
  "Behavior intelligence",
  "Team collaboration",
  "Retention insights",
  "Culture development",
  "Coaching actions",
  "Workstyle analytics",
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
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Corporate Assessment Program
                </p>
              </div>
            </div>

            <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
              <a href="#outcomes" className="transition hover:text-slate-900">Outcomes</a>
              <a href="#science" className="transition hover:text-slate-900">Assessment Model</a>
              <a href="#journey" className="transition hover:text-slate-900">Delivery</a>
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
          <div className="relative grid gap-8 lg:grid-cols-[1.18fr_0.82fr]">
            <article className="section-frame glass-panel rounded-[2rem] p-8 shadow-[0_36px_80px_-40px_rgba(15,23,42,0.62)] md:p-12">
              <div className="hero-noise rounded-[inherit]" />

              <p className="hero-chip">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
                Personality intelligence for modern organizations
              </p>

              <h1 className="font-display mt-7 text-5xl leading-[0.92] text-slate-900 md:text-7xl">
                Buy the assessment program that transforms team behavior.
              </h1>

              <p className="mt-7 max-w-2xl text-base leading-relaxed text-slate-700 md:text-lg">
                OLQLAB helps corporates run high-quality personality and workstyle assessments with clarity, rigor, and
                practical follow-through. We partner with your HR and leadership teams to deliver business-ready
                outcomes through OLQLAB-led operations.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#contact"
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
                >
                  Request Enterprise Proposal
                </a>
                <a
                  href="#journey"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-500"
                >
                  Review Delivery Journey
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="metric-card rounded-xl p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Buyer profile</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">CHRO, L&D, HRBP</p>
                </div>
                <div className="metric-card rounded-xl p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Delivery mode</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Managed by OLQLAB</p>
                </div>
                <div className="metric-card rounded-xl p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Primary outcome</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Coaching-ready insight</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Decision Confidence</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">From individual profiles to leadership-level action.</h3>
                <ul className="detail-list mt-4 text-sm leading-relaxed">
                  <li>Participant reports with strengths, growth areas, and action steps.</li>
                  <li>Leader-facing interpretation focused on coaching behavior.</li>
                  <li>Policy-controlled governance for visibility and release timing.</li>
                </ul>
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

        <section id="outcomes" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Why organizations choose OLQLAB</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              An enterprise program built for behavior change, not dashboard noise.
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {buyerPillars.map((pillar) => (
                <article key={pillar.title} className="hover-lift-strong feature-card rounded-2xl p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{pillar.text}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {corporateUseCases.map((useCase) => (
                <article key={useCase.title} className="hover-lift rounded-2xl border border-slate-200 bg-white/80 p-5">
                  <h3 className="text-base font-semibold text-slate-900">{useCase.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{useCase.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="science" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assessment Model</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Hybrid measurement for personality and real workplace behavior.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700 md:text-base">
              OLQLAB combines trait-based personality items with practical scenario judgments to generate balanced,
              development-focused intelligence for participants and leaders.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {domainSignals.map((item) => (
                <article key={item.domain} className="hover-lift feature-card rounded-2xl p-5">
                  <h3 className="text-base font-semibold text-slate-900">{item.domain}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.signal}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
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

        <section id="journey" className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Delivery Journey</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Five phases from strategy alignment to sustained behavior change.
            </h2>

            <div className="mt-8 grid gap-4 lg:grid-cols-5">
              {rolloutJourney.map((phase) => (
                <article key={phase.step} className="timeline-node hover-lift rounded-2xl border border-slate-200 bg-white/82 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Phase {phase.step}</p>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">{phase.title}</h3>
                  <p className="mt-2 pb-6 text-sm leading-relaxed text-slate-700">{phase.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
          <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Stakeholder Value</p>
            <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
              Every decision-maker sees what matters to their role.
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {stakeholderViews.map((view) => (
                <article key={view.role} className="hover-lift feature-card rounded-2xl p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{view.role}</h3>
                  <ul className="detail-list mt-3 text-sm leading-relaxed">
                    {view.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
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
              Bring OLQLAB into your leadership and development strategy.
            </h2>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">
              Share your team size, goals, and timeline. OLQLAB will recommend the right assessment track, delivery
              model, and reporting structure for your organization.
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
