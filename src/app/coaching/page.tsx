import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  Eyebrow,
  PrimaryCTA,
  TextLink,
} from "@/components/marketing/Editorial";

const steps = [
  {
    title: "Diagnostic",
    body: "Assessment and leadership interview to surface the patterns at play.",
  },
  {
    title: "Blindspot mapping",
    body: "Behavior-pattern readout that names what you couldn't quite see alone.",
  },
  {
    title: "Coaching plan",
    body: "Role-aligned plan with concrete action commitments — not abstractions.",
  },
  {
    title: "Recalibration",
    body: "Follow-up checkpoints, honest measurement, growth recalibrated.",
  },
];

export default function CoachingPage() {
  return (
    <MarketingChrome
      eyebrow="Coaching"
      title="From insight to behavior."
      description="High-touch coaching engagements that convert assessment insight into sustained leadership behavior change."
    >
      {/* COACHING STRUCTURE */}
      <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
        <div className="reveal-on-scroll">
          <Eyebrow>The structure</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
            Four stages, one engagement.
          </h2>
        </div>
        <ol className="border-y border-[#101114]/12 md:border-t-0">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="reveal-on-scroll grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-[#101114]/12 py-9 last:border-b-0 md:gap-x-10 md:py-10"
            >
              <span className="font-display text-2xl text-[#101114]/35 md:text-3xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                {step.title}
              </h3>
              <p className="col-start-2 text-base leading-relaxed text-[#101114]/72">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* BEST FIT */}
      <div className="mt-32 md:mt-40">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll">
            <Eyebrow>Best fit</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
              Where this work pays off.
            </h2>
          </div>
          <div>
            <p className="reveal-on-scroll text-base leading-relaxed text-[#101114]/82 md:text-lg">
              Designed for senior leaders, managers, and succession-candidate cohorts where
              behavioral shift needs to be measurable and role-relevant.
            </p>
            <div className="reveal-on-scroll mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
              <PrimaryCTA href="/contact" className="cta-shimmer">Request a coaching plan</PrimaryCTA>
              <TextLink href="/assessments">View assessments</TextLink>
            </div>
          </div>
        </div>
      </div>
    </MarketingChrome>
  );
}
