import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const olqs = [
  "Effective Intelligence",
  "Determination",
  "Initiative",
  "Self-Confidence",
  "Cooperation",
  "Integrity",
  "Responsibility",
  "Maturity",
  "Adaptability",
  "Emotional Stability",
  "Leadership Potential",
  "Communication Skills",
];

export default function OqlPage() {
  return (
    <MarketingChrome
      title="Officer-Like Qualities Foundations"
      description="Military-tested leadership qualities translated for modern corporate leadership and people development."
    >
      <div className="space-y-6">
        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Core Quality Set</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {olqs.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </article>

        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <p className="text-sm leading-relaxed text-slate-700 md:text-base">
            OLQLAB applies these principles as development signals, not labels. The focus is to improve leadership
            effectiveness, team trust, and decision quality over time.
          </p>
          <Link
            href="/framework"
            className="mt-5 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            Read CPR Framework
          </Link>
        </article>
      </div>
    </MarketingChrome>
  );
}
