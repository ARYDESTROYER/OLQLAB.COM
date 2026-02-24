import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const outcomes = [
  "Hidden behavior patterns that reduce team trust",
  "Decision habits that create avoidable execution risk",
  "Communication gaps between intent and perceived impact",
  "Role-specific actions to reduce repeated leadership friction",
];

export default function BlindspotPage() {
  return (
    <MarketingChrome
      title="Leadership Blindspot Assessment"
      description="See what is hard to see alone, then convert that insight into practical behavior shifts."
    >
      <div className="space-y-6">
        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">What You Get</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {outcomes.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </article>

        <article className="cta-panel relative overflow-hidden rounded-[2rem] p-8 text-white md:p-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Run A Blindspot Sprint</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
            Ideal for leaders stepping into expanded scope, post-reorg transitions, or high-stakes performance cycles.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
            >
              Book Consultation
            </Link>
            <Link
              href="/signin"
              className="rounded-xl border border-slate-500 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Sign In
            </Link>
          </div>
        </article>
      </div>
    </MarketingChrome>
  );
}
