import Image from "next/image";
import PublicHeader from "@/components/navigation/PublicHeader";
import {
  EditorialFooter,
  Eyebrow,
  PrimaryCTA,
  GhostCTA,
  Rule,
  TextLink,
} from "@/components/marketing/Editorial";

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

const dimensions = [
  {
    numeral: "I",
    title: "Cognitive",
    subtitle: "How you think",
    body: "How you process information, analyze complexity, and make strategic decisions. Strong cognitive leaders think systemically and act decisively.",
  },
  {
    numeral: "II",
    title: "Personality",
    subtitle: "How you engage",
    body: "Your presence and influence. How you build relationships, inspire others, and shape the culture around you.",
  },
  {
    numeral: "III",
    title: "Response",
    subtitle: "How you adapt",
    body: "Your resilience under pressure. How you remain effective in chaos and reveal your inner strength.",
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

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-[#F4F1EA] text-[#0B0B0C]">
      <PublicHeader />

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-28 md:px-10 md:pt-28 md:pb-40">
        <div className="reveal">
          <Eyebrow>OLQLAB · Leadership begins within</Eyebrow>
        </div>
        <h1 className="font-display reveal reveal-delay-1 mt-10 text-balance text-[clamp(3rem,9.5vw,9rem)] leading-[0.92] tracking-[-0.035em]">
          Leadership is a<br />journey within.
        </h1>
        <p className="reveal reveal-delay-2 mt-10 max-w-xl text-base leading-relaxed text-[#0B0B0C]/72 md:text-lg">
          Understand yourself deeply. Lead with clarity and compassion. We walk alongside you with
          honest reflection and the wisdom to navigate complexity with grace.
        </p>
        <div className="reveal reveal-delay-3 mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
          <PrimaryCTA href="/assessments">Begin the Assessment</PrimaryCTA>
          <TextLink href="/about">Read the philosophy</TextLink>
        </div>
      </section>

      <Rule />

      {/* MANIFESTO */}
      <section className="mx-auto max-w-4xl px-6 py-28 md:px-10 md:py-40">
        <p className="font-display reveal-on-scroll text-balance text-[clamp(1.6rem,3.4vw,3rem)] leading-[1.18] tracking-[-0.015em] text-[#0B0B0C]/92">
          We believe true leadership begins with self-awareness. Our assessments reveal not just
          who you are, but who you are becoming. Through coaching grounded in behavioral science
          and military-tested wisdom, we help you navigate complexity with grace and lead with
          authentic impact.
        </p>
      </section>

      <Rule />

      {/* FOUNDER */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll md:order-1">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0B0B0C]/5">
              <Image
                src="/pratap-pawar.png"
                alt="Commander (Dr.) Pratap Pawar"
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="editorial-image object-cover"
                priority
              />
            </div>
          </div>
          <div className="md:order-2">
            <div className="reveal-on-scroll">
              <Eyebrow>Your guide</Eyebrow>
            </div>
            <h2 className="font-display reveal-on-scroll mt-6 text-balance text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em]">
              Commander (Dr.) Pratap Pawar
            </h2>
            <p className="reveal-on-scroll mt-8 text-base leading-relaxed text-[#0B0B0C]/78 md:text-lg">
              Twenty-two years in the Indian Navy—Kargil, LTTE operations, the disciplines of
              command at sea. A decade leading people strategy across multinationals. A doctorate
              in behavioral psychology earned in between.
            </p>
            <p className="reveal-on-scroll mt-5 text-base leading-relaxed text-[#0B0B0C]/78 md:text-lg">
              The work he does now is the work he was always doing—helping people see themselves
              clearly enough to lead.
            </p>
            <blockquote className="reveal-on-scroll mt-12 border-l border-[#0B0B0C] pl-6 font-display text-[clamp(1.4rem,2.6vw,2.2rem)] leading-[1.22] tracking-[-0.01em]">
              &ldquo;Leadership isn&rsquo;t about being the loudest in the room. It&rsquo;s about
              understanding the quiet struggles of those around you, and having the courage to
              face your own.&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      <Rule />

      {/* SERVICES */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll">
            <Eyebrow>How we work</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em]">
              Three practices, one outcome.
            </h2>
          </div>
          <ol className="border-y border-[#0B0B0C]/12 md:border-t-0">
            {services.map((item, i) => (
              <li
                key={item.title}
                className="reveal-on-scroll grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-[#0B0B0C]/12 py-9 last:border-b-0 md:gap-x-10 md:py-10"
              >
                <span className="font-display text-2xl text-[#0B0B0C]/35 md:text-3xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-2xl leading-tight md:text-3xl">{item.title}</h3>
                <p className="col-start-2 text-base leading-relaxed text-[#0B0B0C]/72">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Rule />

      {/* CPR DIMENSIONS */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="reveal-on-scroll max-w-2xl">
          <Eyebrow>The CPR Framework</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2.25rem,5vw,4.25rem)] leading-[1.02] tracking-[-0.025em]">
            Three dimensions, one leader.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#0B0B0C]/72 md:text-lg">
            Leadership isn&rsquo;t one-dimensional. The Composite Pattern Recognition model reveals
            three essential dimensions that shape how you lead.
          </p>
        </div>
        <div className="mt-20 grid gap-12 md:grid-cols-3 md:gap-10">
          {dimensions.map((d) => (
            <div
              key={d.title}
              className="reveal-on-scroll border-t border-[#0B0B0C] pt-8"
            >
              <p className="font-display text-5xl leading-none tracking-tight text-[#0B0B0C]/30">
                {d.numeral}
              </p>
              <h3 className="font-display mt-7 text-3xl leading-tight tracking-tight">
                {d.title}
              </h3>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#0B0B0C]/55">
                {d.subtitle}
              </p>
              <p className="mt-5 text-base leading-relaxed text-[#0B0B0C]/76">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Rule />

      {/* WHAT AWAITS */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll">
            <Eyebrow>What awaits</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em]">
              A quieter, more honest way to lead.
            </h2>
          </div>
          <div className="grid gap-x-12 gap-y-12 sm:grid-cols-2">
            {benefits.map((b) => (
              <div key={b.title} className="reveal-on-scroll">
                <h3 className="font-display text-2xl leading-tight tracking-tight">{b.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-[#0B0B0C]/72">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Rule />

      {/* JOURNEY */}
      <section className="mx-auto max-w-5xl px-6 py-28 md:px-10 md:py-36">
        <div className="reveal-on-scroll">
          <Eyebrow>The journey</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.025em]">
            From awareness to mastery.
          </h2>
        </div>
        <ol className="mt-16 border-y border-[#0B0B0C]/12">
          {journey.map((j) => (
            <li
              key={j.numeral}
              className="reveal-on-scroll grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 border-b border-[#0B0B0C]/12 py-10 last:border-b-0 md:grid-cols-[auto_1fr_3fr] md:gap-x-12 md:py-14"
            >
              <span className="font-display text-3xl text-[#0B0B0C]/30 md:text-4xl">
                {j.numeral}
              </span>
              <h3 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                {j.stage}
              </h3>
              <p className="col-start-2 text-base leading-relaxed text-[#0B0B0C]/76 md:col-start-3 md:text-lg">
                {j.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="bg-[#0B0B0C] text-[#F4F1EA]">
        <div className="mx-auto max-w-5xl px-6 py-28 text-center md:px-10 md:py-40">
          <h2 className="font-display reveal-on-scroll text-balance text-[clamp(2.5rem,7vw,6rem)] leading-[0.98] tracking-[-0.03em]">
            Begin the journey.
          </h2>
          <p className="reveal-on-scroll mx-auto mt-8 max-w-xl text-base leading-relaxed text-[#F4F1EA]/72 md:text-lg">
            One assessment. One honest conversation. The rest unfolds from there.
          </p>
          <div className="reveal-on-scroll mt-12 flex justify-center">
            <GhostCTA href="/assessments">Take the Assessment</GhostCTA>
          </div>
        </div>
      </section>

      <EditorialFooter />
    </main>
  );
}
