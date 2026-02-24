import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const expertise = [
  "Culture Diagnostic",
  "Leadership Blindspot Coaching",
  "Organizational Development",
  "Behavioral Analysis",
  "Executive Coaching",
  "Talent Management",
];

export default function AboutPage() {
  return (
    <MarketingChrome
      title="Your Guide On The Leadership Path"
      description="Commander (Dr.) Pratap Pawar brings 35 years of leadership experience from the Indian Navy to corporate transformation programs."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Founder Story</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
            From naval operations and high-stakes command environments to multinational people strategy, this journey
            blends discipline, behavioral science, and human-centered leadership development.
          </p>
          <blockquote className="mt-5 border-l-2 border-cyan-300 pl-4 text-sm italic leading-relaxed text-slate-700 md:text-base">
            &ldquo;Leadership is not about volume. It is about understanding people deeply, including yourself.&rdquo;
          </blockquote>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {expertise.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </article>

        <article className="section-frame glass-panel rounded-[2rem] p-6 md:p-8">
          <h3 className="text-xl font-semibold text-slate-900">How OLQLAB Works</h3>
          <ul className="detail-list mt-4 text-sm leading-relaxed">
            <li>Assessment-led leadership diagnostics.</li>
            <li>Blindspot clarity with coaching recommendations.</li>
            <li>Action plans aligned to role and business context.</li>
            <li>Follow-through checkpoints for sustained behavior change.</li>
          </ul>
          <Link
            href="/signin"
            className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            Sign In
          </Link>
        </article>
      </div>
    </MarketingChrome>
  );
}
