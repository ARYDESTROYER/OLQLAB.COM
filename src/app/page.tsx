import Image from "next/image";
import PublicHeader from "@/components/navigation/PublicHeader";
import {
  EditorialFooter,
  Eyebrow,
  PrimaryCTA,
  SecondaryCTA,
  GhostCTA,
  Rule,
  Marquee,
} from "@/components/marketing/Editorial";
import Magnetic from "@/components/effects/Magnetic";
import RotatingBadge from "@/components/marketing/RotatingBadge";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Leadership begins within",
  description:
    "Leadership assessments, blindspot work, and coaching that turn behavioral insight into practical growth.",
  path: "/",
});

const dimensionsRich = [
  {
    code: "C",
    numeral: "I",
    title: "Cognitive",
    subtitle: "How you think",
    body: "How leaders process complexity, evaluate tradeoffs, and make strategic decisions under constraints.",
  },
  {
    code: "P",
    numeral: "II",
    title: "Personality",
    subtitle: "How you engage",
    body: "How leaders influence, build trust, and shape culture through presence, communication, and empathy.",
  },
  {
    code: "R",
    numeral: "III",
    title: "Response",
    subtitle: "How you adapt",
    body: "How leaders remain effective in stress, recover from setbacks, and adapt behavior in changing contexts.",
  },
];

const heroStats = [
  { num: "35", label: "Years lived in leadership" },
  { num: "3", label: "Dimensions of CPR" },
  { num: "22", label: "Years naval service" },
];

const services = [
  {
    title: "Transformational leadership development",
    body: "Personalized coaching grounded in behavioral science. Navigate complexity with newfound clarity and confidence.",
  },
  {
    title: "Building teams that flourish",
    body: "Diversity of thought is strength. Build inclusive, high-performing teams where every voice contributes its best.",
  },
  {
    title: "Strategic talent and succession",
    body: "Identify emerging talent, nurture pipelines, and create cultures where people grow and stay.",
  },
];

const benefits = [
  {
    title: "Self-clarity",
    body: "See yourself as others see you. Understand your true strengths and growth areas.",
  },
  {
    title: "Reduced blindspots",
    body: "Illuminate hidden patterns and transform them into strengths.",
  },
  {
    title: "Enhanced relationships",
    body: "As you understand yourself better, your relationships naturally deepen.",
  },
  {
    title: "Resilience",
    body: "Develop the inner strength to navigate uncertainty with wisdom.",
  },
  {
    title: "Authentic leadership",
    body: "Stop performing. Start leading from your true self.",
  },
  {
    title: "Organisational impact",
    body: "Your growth ripples through your teams, your culture, and your results.",
  },
];

const journey = [
  {
    numeral: "01",
    stage: "Awareness",
    body: "Honest self-reflection. Our assessment reveals your CPR profile—your strengths, growth areas, and the patterns that shape your leadership.",
  },
  {
    numeral: "02",
    stage: "Understanding",
    body: "Through personalized coaching, you uncover not just what you are, but why. Blindspots become opportunities.",
  },
  {
    numeral: "03",
    stage: "Integration",
    body: "Insight becomes action. New capabilities, more authentic leadership, deeper effectiveness.",
  },
  {
    numeral: "04",
    stage: "Mastery",
    body: "Sustained growth. As you evolve, you help others on their journey. Leadership becomes a shared practice.",
  },
];

const marqueeWords = [
  "Cognitive",
  "Personality",
  "Response",
  "Discipline",
  "Compassion",
  "Resilience",
  "Clarity",
  "Integrity",
  "Authenticity",
  "Steadiness",
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-[#EFE8DA] text-[#101114]">
      <PublicHeader />

      {/* HERO ------------------------------------------------ */}
      <section className="relative overflow-hidden">
        {/* Atmospheric warmth glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(140% 100% at 88% 112%, rgba(181,128,60,0.12), transparent 58%)",
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-14 md:px-10 md:pt-16">
          <div className="grid gap-12 md:grid-cols-[1.55fr_1fr] md:gap-x-16">
            {/* LEFT — headline + subhead + CTAs */}
            <div className="md:pt-4">
              <div className="reveal">
                <Eyebrow>OLQLAB · Leadership begins within</Eyebrow>
              </div>

              <h1
                className="font-display reveal reveal-delay-1 mt-10 text-[clamp(3rem,9.5vw,9.5rem)] leading-[0.95] tracking-[-0.035em]"
                aria-label="Leadership is a journey within."
              >
                <span className="block">Leadership</span>
                <span className="display-italic block text-[#101114]/82">
                  is a journey
                </span>
                <span className="block">
                  within
                  <span className="brass-period">.</span>
                </span>
              </h1>

              <div className="reveal reveal-delay-3 mt-12 grid gap-y-10 md:grid-cols-[1fr_auto] md:items-end md:gap-x-12">
                <p className="drop-cap max-w-md text-base leading-relaxed text-[#101114]/82 md:text-lg">
                  Understand yourself deeply. Lead with clarity and compassion. We walk
                  alongside you—offering honest reflection and the wisdom to navigate
                  complexity with grace.
                </p>
              </div>

              <div className="reveal reveal-delay-4 mt-10 flex flex-wrap items-center gap-4">
                <Magnetic strength={0.22}>
                  <PrimaryCTA href="/assessments" className="cta-shimmer">
                    Begin the assessment
                  </PrimaryCTA>
                </Magnetic>
                <SecondaryCTA href="/about">Read the philosophy</SecondaryCTA>
              </div>
            </div>

            {/* RIGHT — rotating badge + stats */}
            <div className="flex flex-col justify-between gap-12 md:items-end">
              <div className="reveal reveal-delay-2 w-[clamp(140px,18vw,200px)] self-end">
                <RotatingBadge />
              </div>

              <dl className="reveal reveal-delay-3 w-full md:max-w-[320px]">
                {heroStats.map((s) => (
                  <div key={s.num} className="stat-row">
                    <dt className="stat-num">{s.num}</dt>
                    <dd className="stat-label">{s.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Scroll-to-read divider */}
          <div className="reveal reveal-delay-4 hero-divider mt-16 md:mt-20">
            <span className="flex items-center gap-2">
              <span aria-hidden>↓</span>
              Scroll to read
            </span>
            <span>A practice, not a performance.</span>
          </div>
        </div>

        {/* MARQUEE — at the very bottom of the hero band */}
        <div className="relative z-10 mt-10 border-y border-[#101114]/12 bg-[#F4EEE0]">
          <Marquee items={marqueeWords} />
        </div>
      </section>

      {/* MANIFESTO ------------------------------------------- */}
      <section className="mx-auto max-w-4xl px-6 py-32 md:px-10 md:py-44">
        <ManifestoReveal />
      </section>

      {/* FOUNDER --------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-6 py-32 md:px-10 md:py-44">
        <div className="grid gap-16 md:grid-cols-[5fr_7fr] md:gap-24">
          <div className="md:order-1">
            <div className="reveal-on-scroll relative aspect-[4/5] w-full overflow-hidden bg-[#101114]/5">
              <Image
                src="/pratap-pawar.jpg"
                alt="Commander (Dr.) Pratap Pawar"
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="editorial-image object-cover"
              />
            </div>
            <div className="mt-5 flex items-center">
              <span className="brass-dot" aria-hidden />
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
                A practice by Cdr. (Dr.) Pratap Pawar
              </p>
            </div>
          </div>
          <div className="md:order-2">
            <div className="reveal-on-scroll">
              <Eyebrow>Your guide</Eyebrow>
            </div>
            <h2 className="font-display reveal-on-scroll mt-6 text-balance text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.025em]">
              Commander (Dr.) Pratap Pawar
              <span className="brass-period">.</span>
            </h2>
            <p className="reveal-on-scroll mt-10 text-base leading-relaxed text-[#101114]/78 md:text-lg">
              Twenty-two years in the Indian Navy—Kargil, LTTE operations, the disciplines
              of command at sea. A decade leading people strategy across multinationals. A
              doctorate in behavioral psychology earned in between.
            </p>
            <p className="reveal-on-scroll mt-5 text-base leading-relaxed text-[#101114]/78 md:text-lg">
              The work he does now is the work he was always doing—helping people see
              themselves clearly enough to lead.
            </p>
            <blockquote
              className="reveal-on-scroll mt-12 border-l-2 pl-6 font-display text-[clamp(1.4rem,2.6vw,2.4rem)] leading-[1.22] tracking-[-0.01em]"
              style={{ borderLeftColor: "#B5803C" }}
            >
              &ldquo;Leadership isn&rsquo;t about being the loudest in the room.
              It&rsquo;s about understanding the quiet struggles of those around you, and
              having the courage to face your own.&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      <Rule />

      {/* SERVICES -------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll">
            <Eyebrow>How we work</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em]">
              Three practices, one outcome
              <span className="brass-period">.</span>
            </h2>
          </div>
          <ol className="border-y border-[#101114]/12 md:border-t-0">
            {services.map((item, i) => (
              <li
                key={item.title}
                className="reveal-on-scroll grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-[#101114]/12 py-9 last:border-b-0 md:gap-x-10 md:py-10"
              >
                <span className="font-display text-3xl text-[#101114]/35 md:text-4xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-2xl leading-tight md:text-3xl">
                  {item.title}
                </h3>
                <p className="col-start-2 text-base leading-relaxed text-[#101114]/72">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Rule />

      {/* CPR DIMENSIONS — vertical row layout with huge brass letters --- */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="reveal-on-scroll max-w-2xl">
          <Eyebrow>The CPR Framework</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.025em]">
            The shape of every leader
            <span className="brass-period">.</span>
          </h2>
        </div>

        <ol className="mt-14 border-y border-[#101114]/12 md:mt-20">
          {dimensionsRich.map((d) => (
            <li
              key={d.code}
              className="reveal-on-scroll grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 border-b border-[#101114]/12 py-12 last:border-b-0 md:grid-cols-[10rem_1fr_2fr_auto] md:gap-x-12 md:py-16"
            >
              <span
                className="font-display leading-none"
                style={{
                  fontSize: "clamp(4rem, 8vw, 7rem)",
                  color: "#B5803C",
                  letterSpacing: "-0.04em",
                }}
              >
                {d.code}
              </span>

              <div className="md:pr-6">
                <h3 className="font-display text-2xl leading-tight tracking-tight md:text-4xl">
                  {d.title}
                </h3>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
                  {d.subtitle}
                </p>
              </div>

              <p className="col-span-2 text-base leading-relaxed text-[#101114]/76 md:col-span-1 md:text-lg">
                {d.body}
              </p>

              <span className="hidden font-display text-sm tracking-[0.18em] text-[#101114]/35 md:block">
                {d.numeral}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Rule />

      {/* WHAT AWAITS — 3x2 grid with internal hairlines --------- */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="reveal-on-scroll max-w-2xl">
          <Eyebrow>What awaits</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em]">
            A quieter, more honest way to lead
            <span className="brass-period">.</span>
          </h2>
        </div>

        <div className="grid-cells mt-14 md:mt-20">
          {benefits.map((b, i) => (
            <div
              key={b.title}
              data-stagger={String((i % 3) + 1)}
              className="reveal-on-scroll"
            >
              <p className="text-[11px] font-medium tracking-[0.22em] text-[#101114]/45">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="font-display mt-3 text-xl leading-tight tracking-tight md:text-2xl">
                {b.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#101114]/72 md:text-base">
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Rule />

      {/* JOURNEY --------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-6 py-28 md:px-10 md:py-36">
        <div className="reveal-on-scroll">
          <Eyebrow>The journey</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.025em]">
            From awareness to mastery
            <span className="brass-period">.</span>
          </h2>
        </div>
        <ol className="mt-16 border-y border-[#101114]/12">
          {journey.map((j) => (
            <li
              key={j.numeral}
              className="reveal-on-scroll grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 border-b border-[#101114]/12 py-10 last:border-b-0 md:grid-cols-[6rem_1fr_3fr] md:gap-x-12 md:py-16"
            >
              <span className="font-display text-4xl text-[#101114]/30 md:text-6xl">
                {j.numeral}
              </span>
              <h3 className="font-display text-2xl leading-tight tracking-tight md:text-4xl">
                {j.stage}
              </h3>
              <p className="col-start-2 text-base leading-relaxed text-[#101114]/76 md:col-start-3 md:text-lg">
                {j.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA ------------------------------------------------- */}
      <section className="bg-[#101114] text-[#EFE8DA]">
        <div className="mx-auto max-w-5xl px-6 py-32 text-center md:px-10 md:py-44">
          <h2 className="font-display reveal-on-scroll text-balance text-[clamp(2.5rem,7vw,7rem)] leading-[0.96] tracking-[-0.035em]">
            Begin the journey
            <span style={{ color: "#C9A777" }}>.</span>
          </h2>
          <p className="reveal-on-scroll mx-auto mt-8 max-w-xl text-base leading-relaxed text-[#EFE8DA]/72 md:text-lg">
            One assessment. One honest conversation. The rest unfolds from there.
          </p>
          <div className="reveal-on-scroll mt-14 flex justify-center">
            <Magnetic strength={0.22}>
              <GhostCTA href="/assessments" className="cta-shimmer">
                Take the Assessment
              </GhostCTA>
            </Magnetic>
          </div>
        </div>
      </section>

      <EditorialFooter />
    </main>
  );
}

const MANIFESTO =
  "We believe true leadership begins with self-awareness. Our assessments reveal not just who you are, but who you are becoming. Through coaching grounded in behavioral science and military-tested wisdom, we help you navigate complexity with grace and lead with authentic impact";

function ManifestoReveal() {
  const words = MANIFESTO.split(" ");
  return (
    <p className="reveal-words font-display text-pretty text-[clamp(1.6rem,3.4vw,3.2rem)] leading-[1.18] tracking-[-0.015em] text-[#101114]/92">
      {words.map((w, i) => (
        <span
          key={i}
          className="reveal-word"
          style={{
            ["--i" as never]: i,
            marginRight: i < words.length - 1 ? "0.22em" : 0,
          }}
        >
          {w}
        </span>
      ))}
      <span
        className="reveal-word brass-period"
        style={{ ["--i" as never]: words.length }}
      >
        .
      </span>
    </p>
  );
}
