import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  Eyebrow,
  PrimaryCTA,
  GhostCTA,
  TextLink,
} from "@/components/marketing/Editorial";
import Magnetic from "@/components/effects/Magnetic";
import CprTriangle from "@/components/marketing/CprTriangle";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Leadership assessments",
  description:
    "Understand leadership patterns across strategic thinking, relational impact, resilience, and practical workplace decisions.",
  path: "/assessments",
});

const assessmentRegions: {
  code: "C" | "P" | "R" | "CP" | "PR" | "CR" | "CPR";
  label: string;
  description: string;
}[] = [
  {
    code: "C",
    label: "Cognitive",
    description:
      "Understand strategic thinking, decision discipline, and pattern recognition under complexity.",
  },
  {
    code: "P",
    label: "Personality",
    description:
      "Map communication style, relational impact, and leadership presence across stakeholders.",
  },
  {
    code: "R",
    label: "Response",
    description:
      "Measure resilience, adaptability, and pressure-response behavior in practical work scenarios.",
  },
  {
    code: "CP",
    label: "Visionary",
    description:
      "Combine strategy and influence to evaluate visionary leadership potential.",
  },
  {
    code: "PR",
    label: "Empathetic Strategist",
    description:
      "Blend empathy and resilience to understand team-centered leadership under pressure.",
  },
  {
    code: "CR",
    label: "Steady Navigator",
    description:
      "Evaluate analytical consistency and adaptability for high-uncertainty operating environments.",
  },
  {
    code: "CPR",
    label: "Comprehensive",
    description:
      "Full-spectrum leadership profile with integrated development priorities and coaching actions.",
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
          Seven tracks. One leader
          <span className="brass-period">.</span>
        </h2>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[#101114]/72 md:text-lg">
          Three primary dimensions, three pairings, and one comprehensive read.
          Select any region of the diagram to see what each track measures.
        </p>
      </div>

      <div className="mt-16 md:mt-24">
        <CprTriangle
          regions={assessmentRegions}
          defaultActive="CPR"
          hint="Select a region of the triangle. Arrow keys move between regions."
        />
      </div>

      <div className="reveal-on-scroll mt-20 flex flex-wrap items-center gap-x-8 gap-y-5 md:mt-28">
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
