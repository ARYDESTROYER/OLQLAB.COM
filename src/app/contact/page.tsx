import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

export default function ContactPage() {
  return (
    <MarketingChrome
      title="Contact OLQLAB"
      description="Share your team size, goals, and timeline. We will recommend the right diagnostic and coaching track."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Consultation</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
            For enterprise programs, include cohort size, leadership levels, and the timeline you want to run.
          </p>
          <a
            href="mailto:hello@olqlab.com?subject=OLQLAB%20Consultation"
            className="mt-5 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            Email hello@olqlab.com
          </a>
        </article>

        <article className="section-frame glass-panel rounded-[2rem] p-7 md:p-9">
          <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-4xl">Existing Clients</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
            Already enrolled? Access your workspace, assessments, and reports directly.
          </p>
          <Link
            href="/signin"
            className="mt-5 inline-block rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
          >
            Client Sign In
          </Link>
        </article>
      </div>
    </MarketingChrome>
  );
}
