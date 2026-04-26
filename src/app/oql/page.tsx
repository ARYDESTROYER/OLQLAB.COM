import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { Eyebrow, PrimaryCTA, TextLink } from "@/components/marketing/Editorial";

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
      eyebrow="Foundations"
      title="Officer-like qualities, translated."
      description="Military-tested leadership qualities translated for modern corporate leadership and people development."
    >
      {/* QUALITIES */}
      <div className="reveal-on-scroll max-w-2xl">
        <Eyebrow>The core quality set</Eyebrow>
        <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em]">
          Twelve qualities. One leader.
        </h2>
      </div>

      <ul className="mt-16 grid gap-x-12 gap-y-0 border-y border-[#101114]/12 sm:grid-cols-2 sm:gap-x-16 lg:grid-cols-3 lg:gap-x-20">
        {olqs.map((item, i) => (
          <li
            key={item}
            data-stagger={String((i % 3) + 1)}
            className="reveal-on-scroll grid grid-cols-[auto_1fr] items-baseline gap-6 border-b border-[#101114]/12 py-7 last:border-b-0 md:gap-8 md:py-9"
          >
            <span className="font-display text-xl text-[#101114]/35 md:text-2xl">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-display text-lg leading-tight tracking-tight md:text-xl">
              {item}
            </h3>
          </li>
        ))}
      </ul>

      {/* APPLICATION */}
      <div className="mt-32 md:mt-40">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll">
            <Eyebrow>In application</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
              Signals, not labels.
            </h2>
          </div>
          <div>
            <p className="reveal-on-scroll text-base leading-relaxed text-[#101114]/82 md:text-lg">
              OLQLAB applies these principles as development signals, not labels. The focus is
              to improve leadership effectiveness, team trust, and decision quality over time.
            </p>
            <div className="reveal-on-scroll mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
              <PrimaryCTA href="/framework" className="cta-shimmer">Read the CPR Framework</PrimaryCTA>
              <TextLink href="/assessments">See assessments</TextLink>
            </div>
          </div>
        </div>
      </div>
    </MarketingChrome>
  );
}
