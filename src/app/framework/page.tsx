import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { Eyebrow, PrimaryCTA, TextLink } from "@/components/marketing/Editorial";
import CprTriangle from "@/components/marketing/CprTriangle";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "CPR leadership framework",
  description:
    "Explore OLQ Lab's Cognitive, Personality, and Response framework for understanding leadership behavior and growth.",
  path: "/framework",
});

const dimensions = [
  {
    numeral: "I",
    code: "C",
    title: "Cognitive",
    subtitle: "How you think",
    text: "How leaders process complexity, evaluate tradeoffs, and make strategic decisions under constraints.",
  },
  {
    numeral: "II",
    code: "P",
    title: "Personality",
    subtitle: "How you engage",
    text: "How leaders influence, build trust, and shape culture through presence, communication, and empathy.",
  },
  {
    numeral: "III",
    code: "R",
    title: "Response",
    subtitle: "How you adapt",
    text: "How leaders remain effective in stress, recover from setbacks, and adapt behavior in changing contexts.",
  },
];

const archetypeRegions: {
  code: "C" | "P" | "R" | "CP" | "PR" | "CR" | "CPR";
  label: string;
  description: string;
}[] = [
  {
    code: "C",
    label: "Strategic Thinker",
    description:
      "Pattern recognition under complexity. Decision discipline. The C-led leader brings analytical clarity to ambiguous problems.",
  },
  {
    code: "P",
    label: "Relational Leader",
    description:
      "Trust, presence, and communication. The P-led leader shapes culture through how they show up in the room.",
  },
  {
    code: "R",
    label: "Resilient Leader",
    description:
      "Calm under pressure, adaptive in chaos. The R-led leader holds the line when conditions shift around them.",
  },
  {
    code: "CP",
    label: "Visionary",
    description:
      "Strategy meets influence. Sees what is possible, then brings people along — combining analytical clarity with relational presence.",
  },
  {
    code: "PR",
    label: "Empathetic Strategist",
    description:
      "Reads people and pressure together. Leads team-centered through stress, with empathy as the steadying force.",
  },
  {
    code: "CR",
    label: "Steady Navigator",
    description:
      "Analytical consistency married to adaptability. Reliable judgment in high-uncertainty operating environments.",
  },
  {
    code: "CPR",
    label: "Balanced Leader",
    description:
      "All three dimensions held in proportion. Rare — and worth working toward. The integrated profile most teams need at the top.",
  },
];

export default function FrameworkPage() {
  return (
    <MarketingChrome
      eyebrow="The framework"
      title="Composite Pattern Recognition."
      description="A practical leadership model that combines thinking, engagement, and adaptation into one developmental lens."
    >
      {/* THREE DIMENSIONS */}
      <div className="reveal-on-scroll max-w-2xl">
        <Eyebrow>Three dimensions</Eyebrow>
        <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em]">
          The shape of every leader
          <span className="brass-period">.</span>
        </h2>
      </div>
      <div className="mt-16 grid gap-14 md:grid-cols-3 md:gap-12">
        {dimensions.map((d, i) => (
          <div
            key={d.code}
            data-stagger={String(i + 1)}
            className="reveal-on-scroll border-t border-[#101114] pt-8"
          >
            <div className="flex items-baseline gap-5">
              <p className="font-display text-5xl leading-none tracking-tight text-[#101114]/30">
                {d.numeral}
              </p>
              <p className="font-display text-3xl leading-none tracking-tight text-[#101114]/85">
                {d.code}
              </p>
            </div>
            <h3 className="font-display mt-7 text-3xl leading-tight tracking-tight">{d.title}</h3>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
              {d.subtitle}
            </p>
            <p className="mt-5 text-base leading-relaxed text-[#101114]/76">{d.text}</p>
          </div>
        ))}
      </div>

      {/* ARCHETYPES — interactive triangle */}
      <div className="mt-32 md:mt-40">
        <div className="reveal-on-scroll max-w-2xl">
          <Eyebrow>Seven archetypes</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em]">
            How the dimensions combine
            <span className="brass-period">.</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#101114]/72 md:text-lg">
            Each leader expresses these dimensions in a unique pattern. Seven recognisable
            archetypes emerge — each with its own gifts and growth edges.
          </p>
        </div>

        <div className="mt-16 md:mt-24">
          <CprTriangle
            regions={archetypeRegions}
            defaultActive="CPR"
            hint="Hover or tap a region of the triangle."
          />
        </div>

        <div className="reveal-on-scroll mt-20 flex flex-wrap items-center gap-x-8 gap-y-5 md:mt-28">
          <PrimaryCTA href="/assessments" className="cta-shimmer">
            Explore assessments
          </PrimaryCTA>
          <TextLink href="/oql">Read the OLQ foundations</TextLink>
        </div>
      </div>
    </MarketingChrome>
  );
}
