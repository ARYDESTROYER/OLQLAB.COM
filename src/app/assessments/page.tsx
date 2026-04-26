import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  Eyebrow,
  PrimaryCTA,
  GhostCTA,
  TextLink,
} from "@/components/marketing/Editorial";
import Magnetic from "@/components/effects/Magnetic";

const assessments = [
  {
    code: "C",
    title: "Cognitive",
    text: "Understand strategic thinking, decision discipline, and pattern recognition under complexity.",
  },
  {
    code: "P",
    title: "Personality",
    text: "Map communication style, relational impact, and leadership presence across stakeholders.",
  },
  {
    code: "R",
    title: "Response",
    text: "Measure resilience, adaptability, and pressure-response behavior in practical work scenarios.",
  },
  {
    code: "CP",
    title: "Visionary",
    text: "Combine strategy and influence to evaluate visionary leadership potential.",
  },
  {
    code: "PR",
    title: "Empathetic Strategist",
    text: "Blend empathy and resilience to understand team-centered leadership under pressure.",
  },
  {
    code: "CR",
    title: "Steady Navigator",
    text: "Evaluate analytical consistency and adaptability for high-uncertainty operating environments.",
  },
  {
    code: "CPR",
    title: "Comprehensive",
    text: "Full-spectrum leadership profile with integrated development priorities and coaching actions.",
  },
];

export default function AssessmentsPage() {
  return (
    <MarketingChrome
      eyebrow="Assessments"
      title="Mapping leadership behavior."
      description="Choose focused or combined tracks to map leadership behavior and translate insight into action."
      tail={<CohortCTA />}
    >
      {/* CATALOGUE */}
      <div className="reveal-on-scroll max-w-2xl">
        <Eyebrow>The catalogue</Eyebrow>
        <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em]">
          Seven tracks. One leader.
        </h2>
      </div>

      <ul className="mt-16 border-y border-[#101114]/12">
        {assessments.map((a) => (
          <li
            key={a.code}
            className="reveal-on-scroll grid grid-cols-[6rem_1fr] items-baseline gap-x-6 border-b border-[#101114]/12 py-10 last:border-b-0 md:grid-cols-[10rem_minmax(0,18rem)_1fr] md:gap-x-12 md:py-14"
          >
            <p className="font-display text-3xl leading-none tracking-[-0.02em] md:text-5xl">
              {a.code}
            </p>
            <h3 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
              {a.title}
            </h3>
            <p className="col-start-1 col-span-2 mt-3 text-base leading-relaxed text-[#101114]/72 md:col-start-3 md:col-span-1 md:mt-0 md:text-lg">
              {a.text}
            </p>
          </li>
        ))}
      </ul>

      <div className="reveal-on-scroll mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
        <Magnetic strength={0.18}>
          <PrimaryCTA href="/signin" className="cta-shimmer">
            Begin an assessment
          </PrimaryCTA>
        </Magnetic>
        <TextLink href="/framework">Read the framework</TextLink>
      </div>
    </MarketingChrome>
  );
}

function CohortCTA() {
  return (
    <section className="bg-[#101114] text-[#EFE8DA]">
      <div className="mx-auto max-w-5xl px-6 py-28 text-center md:px-10 md:py-40">
        <h2 className="font-display reveal-on-scroll text-balance text-[clamp(2.25rem,6vw,5.5rem)] leading-[1.02] tracking-[-0.03em]">
          Ready to run your first cohort
          <span style={{ color: "#C9A777" }}>?</span>
        </h2>
        <p className="reveal-on-scroll mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[#EFE8DA]/72 md:text-lg">
          Start with a guided diagnostic program and get participant insights, leadership
          reports, and rollout support.
        </p>
        <div className="reveal-on-scroll mt-12 flex flex-wrap justify-center gap-x-8 gap-y-5">
          <Magnetic strength={0.2}>
            <GhostCTA href="/contact" className="cta-shimmer">
              Contact the team
            </GhostCTA>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
