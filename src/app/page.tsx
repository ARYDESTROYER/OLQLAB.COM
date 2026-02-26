import Link from "next/link";
import Image from "next/image";
import PublicHeader from "@/components/navigation/PublicHeader";

const expertiseAreas = [
  "Culture Diagnostic",
  "Leadership Blindspot Coaching",
  "Organizational Development",
  "Behavioral Analysis",
  "Executive Coaching",
  "Talent Management",
];

const humanTouchCards = [
  {
    title: "Transformational Leadership Development",
    description:
      "Like a mentor who knows you deeply, we help you uncover your leadership potential. Through personalized coaching grounded in behavioral science, you'll navigate complexity with newfound clarity and confidence.",
  },
  {
    title: "Building Teams That Flourish",
    description:
      "Great leaders understand that diversity of thought is strength. We help you build inclusive, high-performing teams where every voice matters and every person can contribute their best.",
  },
  {
    title: "Strategic Talent and Succession Planning",
    description:
      "Organizations thrive when they invest in people. We help you identify emerging talent, nurture leadership pipelines, and create cultures where people grow and stay.",
  },
];

const cprDimensions = [
  {
    title: "Cognitive",
    subtitle: "How You Think",
    description:
      "Your cognitive dimension reflects how you process information, analyze complexity, and make strategic decisions. Strong cognitive leaders think systemically and act decisively.",
  },
  {
    title: "Personality",
    subtitle: "How You Engage",
    description:
      "Your personality dimension is about your presence and influence. How do you build relationships? How do you inspire others? How do you create the culture around you?",
  },
  {
    title: "Response",
    subtitle: "How You Adapt",
    description:
      "Your response dimension shows your resilience and adaptability. How do you handle pressure? How do you remain effective in chaos? This dimension reveals your inner strength.",
  },
];

const benefits = [
  {
    title: "Self-Clarity",
    description: "See yourself as others see you. Understand your true strengths and growth areas.",
  },
  {
    title: "Reduced Blindspots",
    description: "Illuminate hidden patterns and transform them into strengths.",
  },
  {
    title: "Enhanced Relationships",
    description: "As you understand yourself better, your relationships naturally deepen.",
  },
  {
    title: "Resilience and Adaptability",
    description: "Develop the inner strength to navigate uncertainty with wisdom.",
  },
  {
    title: "Authentic Leadership",
    description: "Stop performing. Start leading from your true self.",
  },
  {
    title: "Organizational Impact",
    description: "Your growth ripples through your teams, culture, and results.",
  },
];

const journeyStages = [
  {
    stage: "Awareness",
    description:
      "Begin with honest self-reflection. Our assessment reveals your CPR profile-your strengths, growth areas, and the patterns that shape your leadership.",
  },
  {
    stage: "Understanding",
    description:
      "Go deeper. Through personalized coaching, you'll understand not just what you are, but why. You'll uncover your blindspots and see opportunities for growth.",
  },
  {
    stage: "Integration",
    description:
      "Transform insight into action. With guidance and support, you'll develop new capabilities and lead with greater authenticity and effectiveness.",
  },
  {
    stage: "Mastery",
    description:
      "Sustain your growth. As you evolve, you'll help others on their journey. Leadership becomes a shared practice of continuous learning.",
  },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden pb-28">
      <div className="ambient-orb animate-aurora-one -top-40 left-[-140px] h-[460px] w-[460px] bg-cyan-300/60" />
      <div className="ambient-orb animate-aurora-two -right-24 top-24 h-[420px] w-[420px] bg-amber-200/70" />
      <div className="ambient-orb animate-aurora-three bottom-14 left-1/3 h-[360px] w-[360px] bg-emerald-200/45" />

      <PublicHeader />

      <section className="mx-auto max-w-7xl px-6 pt-16 md:px-10 md:pt-24">
        <div className="section-frame glass-panel rounded-[2rem] p-8 text-center shadow-[0_36px_80px_-40px_rgba(15,23,42,0.62)] md:p-14">
          <Image
            src="/logo.png"
            alt="OLQLab Logo"
            width={72}
            height={72}
            className="mx-auto mb-6 rounded-full shadow-md"
            priority
          />
          <p className="hero-chip mx-auto">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
            Leadership begins within
          </p>
          <h1 className="font-display mt-7 text-5xl leading-[0.92] text-slate-900 md:text-7xl">
            Leadership is a Journey Within
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-relaxed text-slate-700 md:text-lg">
            Understand yourself deeply. Lead with clarity and compassion. Like a trusted elder brother, we walk
            alongside you-offering honest reflection and the wisdom to navigate complexity with grace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/assessments"
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
            >
              Explore Assessments
            </Link>
            <Link
              href="/about"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-500"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-6 md:px-10">
        <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-8 md:p-10">
          <p className="mx-auto max-w-4xl text-center text-base leading-relaxed text-slate-700 md:text-lg">
            At OLQLab, we believe that true leadership begins with self-awareness. Our assessments reveal not just who
            you are, but who you&rsquo;re becoming. Through personalized coaching grounded in behavioral science and
            military-tested wisdom, we help you navigate complexity with grace and lead with authentic impact.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
        <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-10">
            <div>
              <h2 className="font-display text-4xl leading-tight text-slate-900 md:text-5xl">
                Your Guide on the Leadership Path
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-slate-700 md:text-base">
                Commander (Dr.) Pratap Pawar brings 35 years of lived experience in leadership-from the disciplined
                halls of the Indian Navy to the dynamic corridors of corporate excellence. His journey spans 22 years
                of naval service, including the Kargil conflict and LTTE operations, where he learned that true
                strength lies in understanding people deeply.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
                With a PhD in Behavioral Psychology and a decade leading people strategy in multinational corporations,
                Pratap embodies a rare blend: the rigor of military training, the wisdom of academic research, and the
                empathy of someone who has walked many paths.
              </p>
              <blockquote className="mt-5 border-l-2 border-cyan-300 pl-4 text-sm italic leading-relaxed text-slate-700 md:text-base">
                &ldquo;Leadership isn&rsquo;t about being the loudest in the room. It&rsquo;s about understanding the quiet
                struggles of those around you, and having the courage to face your own.&rdquo;
              </blockquote>
            </div>

            <article className="feature-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-900">Expertise Areas</h3>
              <ul className="detail-list mt-4 text-sm leading-relaxed">
                {expertiseAreas.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
        <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How We Help You Lead</p>
          <h2 className="font-display mt-3 text-4xl leading-tight text-slate-900 md:text-5xl">
            Through coaching and assessment across three dimensions.
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {humanTouchCards.map((item) => (
              <article key={item.title} className="hover-lift-strong feature-card rounded-2xl p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
        <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
          <h2 className="font-display text-4xl leading-tight text-slate-900 md:text-5xl">
            The Three Dimensions of Leadership
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700 md:text-base">
            Leadership isn&rsquo;t one-dimensional. The Composite Pattern Recognition (CPR) model reveals three essential
            dimensions that shape how you lead.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {cprDimensions.map((item) => (
              <article key={item.title} className="hover-lift feature-card rounded-2xl p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800">{item.subtitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
        <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
          <h2 className="font-display text-4xl leading-tight text-slate-900 md:text-5xl">What Awaits You</h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {benefits.map((item) => (
              <article key={item.title} className="hover-lift rounded-2xl border border-slate-200 bg-white/82 p-5">
                <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6 md:px-10">
        <div className="scroll-reveal section-frame glass-panel rounded-[2rem] p-7 md:p-10">
          <h2 className="font-display text-center text-4xl leading-tight text-slate-900 md:text-5xl">
            Your Transformation Awaits
          </h2>

          <div className="mt-8 space-y-4">
            {journeyStages.map((item, idx) => (
              <article key={item.stage} className="hover-lift feature-card rounded-2xl p-5 md:p-6">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{item.stage}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6 md:px-10">
        <div className="cta-panel relative overflow-hidden rounded-[2rem] p-8 text-center text-white md:p-12">
          <h2 className="font-display text-4xl leading-tight md:text-6xl">Begin Your Journey</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
            Take the first step toward deeper self-understanding and transformational leadership.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/assessments"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
            >
              Explore Assessments
            </Link>
            <Link
              href="/framework"
              className="rounded-xl border border-slate-500 bg-slate-800/80 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Learn About CPR
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-cyan-200 bg-cyan-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-20 max-w-7xl px-6 md:px-10">
        <div className="section-frame glass-panel rounded-[2rem] p-7 md:p-10">
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">About</h4>
              <div className="mt-3 space-y-2">
                <Link href="/about" className="block text-sm text-slate-600 hover:text-slate-900">Our Approach</Link>
                <Link href="/framework" className="block text-sm text-slate-600 hover:text-slate-900">CPR Framework</Link>
                <Link href="/oql" className="block text-sm text-slate-600 hover:text-slate-900">OLQ Foundations</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Services</h4>
              <div className="mt-3 space-y-2">
                <Link href="/assessments" className="block text-sm text-slate-600 hover:text-slate-900">Assessments</Link>
                <Link href="/coaching" className="block text-sm text-slate-600 hover:text-slate-900">Coaching</Link>
                <Link href="/blindspot" className="block text-sm text-slate-600 hover:text-slate-900">Blindspot Work</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Resources</h4>
              <div className="mt-3 space-y-2">
                <Link href="/framework" className="block text-sm text-slate-600 hover:text-slate-900">Framework Notes</Link>
                <Link href="/contact" className="block text-sm text-slate-600 hover:text-slate-900">Contact</Link>
                <Link href="/assessments" className="block text-sm text-slate-600 hover:text-slate-900">Offerings</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Connect</h4>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Have questions? We are here to support your leadership journey.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-col items-center gap-4 border-t border-slate-200 pt-7 md:flex-row md:justify-between md:gap-0">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="OLQLab Logo" width={32} height={32} className="rounded-full opacity-80" />
              <p className="text-sm font-semibold tracking-wider text-slate-900">OLQLAB</p>
            </div>
            <p className="text-center text-sm text-slate-600">&copy; 2026 OLQLab. All rights reserved.</p>
            <p className="text-center text-sm text-slate-500">Leadership begins within.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
