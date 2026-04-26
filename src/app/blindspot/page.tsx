import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { Eyebrow, GhostCTA } from "@/components/marketing/Editorial";

const outcomes = [
  {
    title: "Hidden behaviors",
    body: "Patterns that quietly reduce team trust without anyone naming them.",
  },
  {
    title: "Risky decision habits",
    body: "The defaults that create avoidable execution risk under pressure.",
  },
  {
    title: "Intent-impact gaps",
    body: "Communication that lands differently than it was meant to.",
  },
  {
    title: "Practical next moves",
    body: "Role-specific actions that reduce repeated leadership friction.",
  },
];

export default function BlindspotPage() {
  return (
    <MarketingChrome
      eyebrow="Blindspot work"
      title="See what is hard to see alone."
      description="Then convert that insight into practical behavior shifts."
      tail={<SprintCTA />}
    >
      {/* OUTCOMES */}
      <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
        <div className="reveal-on-scroll">
          <Eyebrow>What you get</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
            Four shifts you can act on.
          </h2>
        </div>
        <ul className="border-y border-[#0B0B0C]/12 md:border-t-0">
          {outcomes.map((o, i) => (
            <li
              key={o.title}
              className="reveal-on-scroll grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-[#0B0B0C]/12 py-9 last:border-b-0 md:gap-x-10 md:py-10"
            >
              <span className="font-display text-2xl text-[#0B0B0C]/35 md:text-3xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                {o.title}
              </h3>
              <p className="col-start-2 text-base leading-relaxed text-[#0B0B0C]/72">{o.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </MarketingChrome>
  );
}

function SprintCTA() {
  return (
    <section className="bg-[#0B0B0C] text-[#F4F1EA]">
      <div className="mx-auto max-w-5xl px-6 py-24 md:px-10 md:py-32">
        <div className="reveal-on-scroll">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#F4F1EA]/55">
            Run a sprint
          </p>
        </div>
        <h2 className="font-display reveal-on-scroll mt-6 text-balance text-[clamp(2.25rem,6vw,5rem)] leading-[1.02] tracking-[-0.025em]">
          For the leaders stepping into more.
        </h2>
        <p className="reveal-on-scroll mt-6 max-w-2xl text-base leading-relaxed text-[#F4F1EA]/72 md:text-lg">
          Ideal for leaders stepping into expanded scope, post-reorg transitions, or
          high-stakes performance cycles.
        </p>
        <div className="reveal-on-scroll mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
          <GhostCTA href="/contact">Book a consultation</GhostCTA>
          <Link
            href="/signin"
            className="text-sm font-medium text-[#F4F1EA]/80 underline underline-offset-[6px] decoration-[#F4F1EA]/30 transition-colors duration-300 hover:text-[#F4F1EA] hover:decoration-[#F4F1EA]"
          >
            Or sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
