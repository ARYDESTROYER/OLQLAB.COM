import Link from "next/link";
import Image from "next/image";
import PublicHeader from "@/components/navigation/PublicHeader";

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
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#0B0B0C]/55">
          OLQLAB · Leadership begins within
        </p>
        <h1 className="font-display mt-10 text-[clamp(3rem,9.5vw,9rem)] leading-[0.92] tracking-[-0.035em]">
          Leadership is a<br />journey within.
        </h1>
        <p className="mt-10 max-w-xl text-base leading-relaxed text-[#0B0B0C]/72 md:text-lg">
          Understand yourself deeply. Lead with clarity and compassion. We walk alongside you
          with honest reflection and the wisdom to navigate complexity with grace.
        </p>
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
          <Link
            href="/assessments"
            className="group inline-flex items-center gap-3 bg-[#0B0B0C] px-7 py-4 text-sm font-medium text-[#F4F1EA] transition-colors duration-200 hover:bg-[#1d1d20]"
          >
            Begin the Assessment
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-[#0B0B0C]/80 underline underline-offset-[6px] decoration-[#0B0B0C]/30 transition-colors hover:text-[#0B0B0C] hover:decoration-[#0B0B0C]"
          >
            Read the philosophy
          </Link>
        </div>
      </section>

      <Rule />

      {/* MANIFESTO */}
      <section className="mx-auto max-w-4xl px-6 py-28 md:px-10 md:py-40">
        <p className="font-display text-[clamp(1.6rem,3.4vw,3rem)] leading-[1.18] tracking-[-0.015em] text-[#0B0B0C]/92">
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
          <div className="md:order-1">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0B0B0C]/5">
              <Image
                src="/pratap-pawar.png"
                alt="Commander (Dr.) Pratap Pawar"
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover grayscale"
                priority
              />
            </div>
          </div>
          <div className="md:order-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#0B0B0C]/55">
              Your guide
            </p>
            <h2 className="font-display mt-6 text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em]">
              Commander (Dr.) Pratap Pawar
            </h2>
            <p className="mt-8 text-base leading-relaxed text-[#0B0B0C]/78 md:text-lg">
              Twenty-two years in the Indian Navy—Kargil, LTTE operations, the disciplines of
              command at sea. A decade leading people strategy across multinationals. A doctorate
              in behavioral psychology earned in between.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[#0B0B0C]/78 md:text-lg">
              The work he does now is the work he was always doing—helping people see themselves
              clearly enough to lead.
            </p>
            <blockquote className="mt-12 border-l border-[#0B0B0C] pl-6 font-display text-[clamp(1.4rem,2.6vw,2.2rem)] leading-[1.22] tracking-[-0.01em]">
              “Leadership isn’t about being the loudest in the room. It’s about understanding the
              quiet struggles of those around you, and having the courage to face your own.”
            </blockquote>
          </div>
        </div>
      </section>

      <Rule />

      {/* SERVICES */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#0B0B0C]/55">
              How we work
            </p>
            <h2 className="font-display mt-6 text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em]">
              Three practices, one outcome.
            </h2>
          </div>
          <ol className="border-y border-[#0B0B0C]/15 md:border-t-0">
            {services.map((item, i) => (
              <li
                key={item.title}
                className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-[#0B0B0C]/15 py-9 last:border-b-0 md:gap-x-10 md:py-10"
              >
                <span className="font-display text-2xl text-[#0B0B0C]/35 md:text-3xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-2xl leading-tight md:text-3xl">{item.title}</h3>
                <p className="col-start-2 text-base leading-relaxed text-[#0B0B0C]/72">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Rule />

      {/* CPR DIMENSIONS */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#0B0B0C]/55">
            The CPR Framework
          </p>
          <h2 className="font-display mt-6 text-[clamp(2.25rem,5vw,4.25rem)] leading-[1.02] tracking-[-0.025em]">
            Three dimensions, one leader.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#0B0B0C]/72 md:text-lg">
            Leadership isn’t one-dimensional. The Composite Pattern Recognition model reveals
            three essential dimensions that shape how you lead.
          </p>
        </div>
        <div className="mt-20 grid gap-12 md:grid-cols-3 md:gap-10">
          {dimensions.map((d) => (
            <div key={d.title} className="border-t border-[#0B0B0C] pt-8">
              <p className="font-display text-5xl leading-none tracking-tight text-[#0B0B0C]/30">
                {d.numeral}
              </p>
              <h3 className="font-display mt-7 text-3xl leading-tight tracking-tight">{d.title}</h3>
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
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#0B0B0C]/55">
              What awaits
            </p>
            <h2 className="font-display mt-6 text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em]">
              A quieter, more honest way to lead.
            </h2>
          </div>
          <div className="grid gap-x-12 gap-y-12 sm:grid-cols-2">
            {benefits.map((b) => (
              <div key={b.title}>
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
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#0B0B0C]/55">
          The journey
        </p>
        <h2 className="font-display mt-6 text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.025em]">
          From awareness to mastery.
        </h2>
        <ol className="mt-16 border-y border-[#0B0B0C]/15">
          {journey.map((j) => (
            <li
              key={j.numeral}
              className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 border-b border-[#0B0B0C]/15 py-10 last:border-b-0 md:grid-cols-[auto_1fr_3fr] md:gap-x-12 md:py-14"
            >
              <span className="font-display text-3xl text-[#0B0B0C]/30 md:text-4xl">{j.numeral}</span>
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
          <h2 className="font-display text-[clamp(2.5rem,7vw,6rem)] leading-[0.98] tracking-[-0.03em]">
            Begin the journey.
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-[#F4F1EA]/72 md:text-lg">
            One assessment. One honest conversation. The rest unfolds from there.
          </p>
          <Link
            href="/assessments"
            className="group mt-12 inline-flex items-center gap-3 border border-[#F4F1EA]/80 px-8 py-4 text-sm font-medium transition-colors duration-200 hover:bg-[#F4F1EA] hover:text-[#0B0B0C]"
          >
            Take the Assessment
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#0B0B0C]/15">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
          <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="OLQLAB"
                  width={36}
                  height={36}
                  className="rounded-full opacity-90"
                />
                <p className="font-display text-2xl tracking-tight">OLQLAB</p>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#0B0B0C]/64">
                Leadership begins within.
              </p>
            </div>
            <FooterColumn
              title="About"
              links={[
                { label: "Our approach", href: "/about" },
                { label: "CPR framework", href: "/framework" },
                { label: "OLQ foundations", href: "/oql" },
              ]}
            />
            <FooterColumn
              title="Practice"
              links={[
                { label: "Assessments", href: "/assessments" },
                { label: "Coaching", href: "/coaching" },
                { label: "Blindspot work", href: "/blindspot" },
              ]}
            />
            <FooterColumn
              title="Contact"
              links={[
                { label: "Get in touch", href: "/contact" },
                { label: "Sign in", href: "/signin" },
              ]}
            />
          </div>
          <div className="mt-16 flex flex-col gap-2 border-t border-[#0B0B0C]/15 pt-8 text-xs text-[#0B0B0C]/55 md:flex-row md:justify-between">
            <p>© 2026 OLQLab. All rights reserved.</p>
            <p>Leadership begins within.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Rule() {
  return (
    <div className="mx-auto max-w-7xl px-6 md:px-10">
      <div className="border-t border-[#0B0B0C]/15" />
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0C]/55">
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-[#0B0B0C]/80 transition-colors hover:text-[#0B0B0C]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
