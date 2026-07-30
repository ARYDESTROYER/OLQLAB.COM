import Image from "next/image";
import Link from "next/link";
import PublicHeader from "@/components/navigation/PublicHeader";
import {
  EditorialFooter,
  Eyebrow,
} from "@/components/marketing/Editorial";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Leadership begins within",
  description:
    "Leadership assessments, blindspot work, and coaching that turn behavioral insight into practical growth.",
  path: "/",
});

const dimensions = [
  {
    code: "C",
    numeral: "01",
    title: "Cognitive",
    subtitle: "How you think",
    body: "How leaders process complexity, evaluate trade-offs, and make clear decisions under constraint.",
  },
  {
    code: "P",
    numeral: "02",
    title: "Personality",
    subtitle: "How you engage",
    body: "How leaders influence, build trust, and shape culture through presence, communication, and empathy.",
  },
  {
    code: "R",
    numeral: "03",
    title: "Response",
    subtitle: "How you adapt",
    body: "How leaders remain effective under pressure, recover from setbacks, and adjust as conditions change.",
  },
];

const heroStats = [
  { num: "35", label: "Years lived in leadership" },
  { num: "03", label: "Dimensions in the CPR framework" },
  { num: "22", label: "Years of naval service" },
];

const services = [
  {
    title: "See the pattern",
    body: "A rigorous assessment makes the habits beneath your decisions visible—without reducing you to a score.",
  },
  {
    title: "Name what matters",
    body: "A candid conversation turns evidence into language you can use with your team, manager, or coach.",
  },
  {
    title: "Practise the shift",
    body: "Small, observable commitments move insight into daily leadership behaviour and durable change.",
  },
];

const outcomes = [
  {
    title: "Self-clarity",
    body: "Understand the strengths, tensions, and blindspots shaping how you lead.",
  },
  {
    title: "Better relationships",
    body: "Read people and situations with more empathy, precision, and steadiness.",
  },
  {
    title: "Resilience",
    body: "Respond to uncertainty deliberately instead of relying on an automatic pattern.",
  },
  {
    title: "Organisational impact",
    body: "Turn personal growth into clearer decisions, healthier teams, and stronger succession.",
  },
];

const journey = [
  {
    numeral: "01",
    stage: "Awareness",
    body: "See the patterns that shape your decisions, relationships, and response to pressure.",
  },
  {
    numeral: "02",
    stage: "Understanding",
    body: "Explore what sits beneath those patterns and where they help or limit you.",
  },
  {
    numeral: "03",
    stage: "Integration",
    body: "Translate insight into behaviours that colleagues can notice and reinforce.",
  },
  {
    numeral: "04",
    stage: "Mastery",
    body: "Sustain the practices that make your leadership more honest, useful, and humane.",
  },
];

const signalCells = [
  { tone: "ink", code: "C", label: "Think" },
  { tone: "brass" },
  { tone: "paper" },
  { tone: "warm" },
  { tone: "paper" },
  { tone: "deep" },
  { tone: "warm", code: "P", label: "Engage" },
  { tone: "brass" },
  { tone: "paper" },
  { tone: "deep" },
  { tone: "ink", code: "R", label: "Adapt" },
  { tone: "warm" },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-[#EFE8DA] text-[#101114]">
      <a className="skip-link" href="#landing-content">
        Skip to content
      </a>
      <PublicHeader />

      <div id="landing-content">
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-hero__shell">
            <div className="landing-hero__headline-cell">
              <div className="landing-rise">
                <Eyebrow>OLQ Lab · Leadership development</Eyebrow>
              </div>
              <h1
                id="landing-hero-title"
                aria-label="Leadership. From within."
                className="landing-hero__headline"
              >
                <span aria-hidden className="landing-rise landing-rise--1 block">
                  Leadership.
                </span>
                <span
                  aria-hidden
                  className="landing-rise landing-rise--2 block font-display italic"
                >
                  From within.
                </span>
              </h1>
            </div>

            <div className="landing-hero__intro">
              <p className="landing-kicker landing-rise landing-rise--2">
                01 / Orientation
              </p>
              <p className="landing-rise landing-rise--3 text-balance text-xl leading-[1.45] tracking-[-0.02em] text-[#101114] md:text-2xl">
                We help leaders see themselves clearly, turn insight into deliberate
                behaviour, and lead complexity with steadiness.
              </p>
              <div className="landing-hero__actions landing-rise landing-rise--4">
                <Link href="/assessments" className="landing-cta landing-cta--primary">
                  Explore assessments
                  <span aria-hidden>↗</span>
                </Link>
                <Link href="/about" className="landing-cta landing-cta--secondary">
                  How OLQ Lab works
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            <div className="landing-signal landing-rise landing-rise--3">
              <div className="landing-signal__header" aria-hidden>
                <span>Leadership signal / CPR</span>
                <span>Observe · Interpret · Practise</span>
              </div>
              <div className="landing-signal__grid" aria-hidden>
                {signalCells.map((cell, index) => (
                  <div
                    key={index}
                    className={`landing-signal__cell landing-signal__cell--${cell.tone}`}
                  >
                    {cell.code ? (
                      <>
                        <span className="landing-signal__code">{cell.code}</span>
                        <span className="landing-signal__label">{cell.label}</span>
                      </>
                    ) : (
                      <span className="landing-signal__point" />
                    )}
                  </div>
                ))}
              </div>
              <p className="sr-only">
                The CPR framework explores how a leader thinks, engages, and adapts.
              </p>
            </div>

            <aside className="landing-hero__proof">
              <p className="landing-kicker">02 / Practice</p>
              <p className="mt-5 max-w-sm text-base leading-relaxed text-[#101114]/72">
                Behavioral science, operational experience, and honest conversation—
                brought together as one practical leadership discipline.
              </p>
              <dl className="landing-proof-stats">
                {heroStats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.num}</dt>
                    <dd>{stat.label}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="practice-heading">
          <div className="landing-two-column">
            <div className="reveal-on-scroll">
              <Eyebrow>A practice, not a performance</Eyebrow>
              <h2 id="practice-heading" className="landing-section-title">
                Insight you can use
                <span className="brass-period">.</span>
              </h2>
              <p className="landing-section-lede">
                True leadership begins with self-awareness. Our work reveals not just
                who you are, but the patterns you can choose to strengthen, soften, or
                leave behind.
              </p>
              <Link href="/about" className="landing-text-link">
                Read our philosophy
                <span aria-hidden>↗</span>
              </Link>
            </div>

            <ol className="landing-practice-list">
              {services.map((service, index) => (
                <li key={service.title} className="reveal-on-scroll">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{service.title}</h3>
                    <p>{service.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-framework" aria-labelledby="framework-heading">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 md:px-12 md:py-28">
            <div className="grid gap-8 md:grid-cols-[1.6fr_1fr] md:items-end">
              <div className="reveal-on-scroll">
                <Eyebrow tone="light">The CPR framework</Eyebrow>
                <h2
                  id="framework-heading"
                  className="mt-7 max-w-4xl text-balance text-[clamp(2.75rem,6.5vw,6.75rem)] leading-[0.94] tracking-[-0.055em]"
                >
                  Three signals.
                  <span className="block font-display italic text-[#C9A777]">
                    One whole leader.
                  </span>
                </h2>
              </div>
              <div className="reveal-on-scroll md:pb-2">
                <p className="max-w-md text-base leading-relaxed text-[#EFE8DA]/72 md:text-lg">
                  CPR gives leaders a common language for thought, relationships, and
                  response—without pretending any one dimension tells the whole story.
                </p>
                <Link href="/framework" className="landing-text-link landing-text-link--light">
                  Explore the framework
                  <span aria-hidden>↗</span>
                </Link>
              </div>
            </div>

            <ol className="landing-dimension-grid">
              {dimensions.map((dimension) => (
                <li key={dimension.code} className="reveal-on-scroll">
                  <div className="flex items-start justify-between gap-6">
                    <span className="landing-dimension-code">{dimension.code}</span>
                    <span className="landing-kicker text-[#EFE8DA]/52">
                      {dimension.numeral}
                    </span>
                  </div>
                  <h3>{dimension.title}</h3>
                  <p className="landing-kicker mt-2 text-[#C9A777]">
                    {dimension.subtitle}
                  </p>
                  <p className="mt-6 text-sm leading-relaxed text-[#EFE8DA]/68 md:text-base">
                    {dimension.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="guide-heading">
          <div className="grid gap-14 md:grid-cols-[0.9fr_1.1fr] md:gap-20 lg:gap-28">
            <div className="reveal-on-scroll">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-[#101114]/5">
                <Image
                  src="/pratap-pawar.jpg"
                  alt="Commander (Dr.) Pratap Pawar"
                  fill
                  sizes="(min-width: 768px) 42vw, 100vw"
                  className="editorial-image object-cover"
                />
                <div className="landing-portrait-caption">
                  <span>22 years</span>
                  <span>Indian Navy</span>
                </div>
              </div>
            </div>

            <div className="reveal-on-scroll md:self-center">
              <Eyebrow>Your guide</Eyebrow>
              <h2 id="guide-heading" className="landing-section-title">
                Experience, examined
                <span className="brass-period">.</span>
              </h2>
              <p className="landing-section-lede">
                Commander (Dr.) Pratap Pawar brings twenty-two years in the Indian Navy,
                a decade leading people strategy, and a doctorate in behavioral
                psychology to one enduring question: how do we help people see
                themselves clearly enough to lead?
              </p>
              <blockquote className="landing-quote">
                “Leadership isn’t about being the loudest in the room. It is about
                understanding the quiet struggles of those around you—and having the
                courage to face your own.”
              </blockquote>
              <Link href="/about" className="landing-text-link">
                Meet Pratap
                <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-growth" aria-labelledby="growth-heading">
          <div className="mx-auto grid max-w-[1440px] gap-16 px-5 py-20 sm:px-8 md:px-12 md:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
            <div>
              <div className="reveal-on-scroll">
                <Eyebrow>What changes</Eyebrow>
                <h2 id="growth-heading" className="landing-section-title">
                  Awareness,
                  <span className="block font-display italic text-[#101114]/72">
                    made practical.
                  </span>
                </h2>
              </div>
              <div className="landing-outcome-grid">
                {outcomes.map((outcome, index) => (
                  <article key={outcome.title} className="reveal-on-scroll">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{outcome.title}</h3>
                    <p>{outcome.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="reveal-on-scroll">
              <p className="landing-kicker">A path, not a promise</p>
              <ol className="landing-journey-list">
                {journey.map((step) => (
                  <li key={step.numeral}>
                    <span>{step.numeral}</span>
                    <div>
                      <h3>{step.stage}</h3>
                      <p>{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="landing-closing" aria-labelledby="closing-heading">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 sm:px-8 md:px-12 md:py-28 lg:grid-cols-[1.5fr_0.5fr] lg:items-end">
            <div className="reveal-on-scroll">
              <p className="landing-kicker text-[#EFE8DA]/55">Start with one honest view</p>
              <h2
                id="closing-heading"
                className="mt-8 max-w-5xl text-balance text-[clamp(3rem,7vw,7.5rem)] leading-[0.92] tracking-[-0.055em]"
              >
                See what your leadership is signalling
                <span className="text-[#C9A777]">.</span>
              </h2>
            </div>
            <div className="reveal-on-scroll lg:pb-2">
              <p className="max-w-sm text-base leading-relaxed text-[#EFE8DA]/68">
                Begin with an assessment, then turn the result into a conversation and
                a practical next step.
              </p>
              <Link href="/assessments" className="landing-cta landing-cta--light">
                Begin the assessment
                <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <EditorialFooter />
    </main>
  );
}
