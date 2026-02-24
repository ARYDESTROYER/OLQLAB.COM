import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const dimensions = [
  {
    title: "Cognitive (C)",
    subtitle: "How You Think",
    text: "How leaders process complexity, evaluate tradeoffs, and make strategic decisions under constraints.",
  },
  {
    title: "Personality (P)",
    subtitle: "How You Engage",
    text: "How leaders influence, build trust, and shape culture through presence, communication, and empathy.",
  },
  {
    title: "Response (R)",
    subtitle: "How You Adapt",
    text: "How leaders remain effective in stress, recover from setbacks, and adapt behavior in changing contexts.",
  },
];

const archetypes = [
  "C - Strategic Thinker",
  "P - Relational Leader",
  "R - Resilient Leader",
  "CP - Visionary",
  "PR - Empathetic Strategist",
  "CR - Steady Navigator",
  "CPR - Balanced Leader",
];

export default function FrameworkPage() {
  return (
    <MarketingChrome
      title="Composite Pattern Recognition Framework"
      description="A practical leadership model that combines thinking, engagement, and adaptation into one developmental lens."
    >
      <div className="space-y-6">
        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Three Dimensions</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {dimensions.map((item) => (
              <div key={item.title} className="feature-card rounded-2xl p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-cyan-800">{item.subtitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Leadership Archetypes</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archetypes.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
          <Link
            href="/assessments"
            className="mt-6 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            Explore Assessments
          </Link>
        </article>
      </div>
    </MarketingChrome>
  );
}
