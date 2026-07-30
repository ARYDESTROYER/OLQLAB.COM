import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { Eyebrow, GhostCTA } from "@/components/marketing/Editorial";
import Magnetic from "@/components/effects/Magnetic";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Leadership blindspot work",
  description:
    "Surface hidden leadership behaviors, decision habits, and intent-impact gaps, then turn them into practical next moves.",
  path: "/blindspot",
});

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
        <ul className="border-y border-[#101114]/12 md:border-t-0">
          {outcomes.map((o, i) => (
            <li
              key={o.title}
              className="reveal-on-scroll grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-[#101114]/12 py-9 last:border-b-0 md:gap-x-10 md:py-10"
            >
              <span className="font-display text-2xl text-[#101114]/35 md:text-3xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                {o.title}
              </h3>
              <p className="col-start-2 text-base leading-relaxed text-[#101114]/72">{o.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </MarketingChrome>
  );
}

function SprintCTA() {
  return (
    <section className="bg-[#101114] text-[#EFE8DA]">
      <div className="mx-auto max-w-5xl px-6 py-28 md:px-10 md:py-40">
        <div className="reveal-on-scroll">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#EFE8DA]/55">
            <span
              className="brass-dot"
              style={{ background: "#C9A777" }}
              aria-hidden
            />
            Run a sprint
          </p>
        </div>
        <h2 className="font-display reveal-on-scroll mt-6 text-balance text-[clamp(2.25rem,6vw,5.5rem)] leading-[1.02] tracking-[-0.03em]">
          For the leaders stepping into more
          <span style={{ color: "#C9A777" }}>.</span>
        </h2>
        <p className="reveal-on-scroll mt-8 max-w-2xl text-base leading-relaxed text-[#EFE8DA]/72 md:text-lg">
          Ideal for leaders stepping into expanded scope, post-reorg transitions, or
          high-stakes performance cycles.
        </p>
        <div className="reveal-on-scroll mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
          <Magnetic strength={0.2}>
            <GhostCTA href="/contact" className="cta-shimmer">
              Book a consultation
            </GhostCTA>
          </Magnetic>
          <Link
            href="/signin"
            className="text-sm font-medium text-[#EFE8DA]/80 underline underline-offset-[6px] decoration-[#EFE8DA]/30 transition-colors duration-300 hover:text-[#EFE8DA] hover:decoration-[#EFE8DA]"
          >
            Or sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
