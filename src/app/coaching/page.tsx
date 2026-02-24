import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const steps = [
  "Diagnostic assessment and leadership interview",
  "Blindspot mapping and behavior-pattern readout",
  "Role-aligned coaching plan with action commitments",
  "Follow-up checkpoints and growth recalibration",
];

export default function CoachingPage() {
  return (
    <MarketingChrome
      title="Executive Coaching"
      description="High-touch coaching engagements that convert assessment insight into sustained leadership behavior change."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Coaching Structure</h2>
          <ol className="mt-5 space-y-3 text-sm text-slate-700">
            {steps.map((step, idx) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Best Fit</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
            Designed for senior leaders, managers, and succession-candidate cohorts where behavioral shift needs to be
            measurable and role-relevant.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Request Coaching Plan
            </Link>
            <Link
              href="/assessments"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
            >
              View Assessments
            </Link>
          </div>
        </article>
      </div>
    </MarketingChrome>
  );
}
