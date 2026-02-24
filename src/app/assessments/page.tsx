import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const assessments = [
  {
    title: "C Assessment",
    text: "Understand strategic thinking, decision discipline, and pattern recognition under complexity.",
  },
  {
    title: "P Assessment",
    text: "Map communication style, relational impact, and leadership presence across stakeholders.",
  },
  {
    title: "R Assessment",
    text: "Measure resilience, adaptability, and pressure-response behavior in practical work scenarios.",
  },
  {
    title: "CP Assessment",
    text: "Combine strategy and influence to evaluate visionary leadership potential.",
  },
  {
    title: "PR Assessment",
    text: "Blend empathy and resilience to understand team-centered leadership under pressure.",
  },
  {
    title: "CR Assessment",
    text: "Evaluate analytical consistency and adaptability for high-uncertainty operating environments.",
  },
  {
    title: "CPR Comprehensive",
    text: "Full-spectrum leadership profile with integrated development priorities and coaching actions.",
  },
];

export default function AssessmentsPage() {
  return (
    <MarketingChrome
      title="Leadership Assessments"
      description="Choose focused or combined tracks to map leadership behavior and translate insight into action."
    >
      <div className="space-y-6">
        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Assessment Catalogue</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assessments.map((item) => (
              <div key={item.title} className="hover-lift feature-card rounded-2xl p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="cta-panel relative overflow-hidden rounded-[2rem] p-8 text-white md:p-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Ready to run your first cohort?</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
            Start with a guided diagnostic program and get participant insights, leadership reports, and rollout support.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
            >
              Contact Team
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
