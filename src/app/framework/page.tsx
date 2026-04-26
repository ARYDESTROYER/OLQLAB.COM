import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { Eyebrow, PrimaryCTA, TextLink } from "@/components/marketing/Editorial";

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

const archetypes = [
  { code: "C", title: "Strategic Thinker" },
  { code: "P", title: "Relational Leader" },
  { code: "R", title: "Resilient Leader" },
  { code: "CP", title: "Visionary" },
  { code: "PR", title: "Empathetic Strategist" },
  { code: "CR", title: "Steady Navigator" },
  { code: "CPR", title: "Balanced Leader" },
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
          The shape of every leader.
        </h2>
      </div>
      <div className="mt-16 grid gap-14 md:grid-cols-3 md:gap-12">
        {dimensions.map((d) => (
          <div key={d.code} className="reveal-on-scroll border-t border-[#0B0B0C] pt-8">
            <div className="flex items-baseline gap-5">
              <p className="font-display text-5xl leading-none tracking-tight text-[#0B0B0C]/30">
                {d.numeral}
              </p>
              <p className="font-display text-3xl leading-none tracking-tight text-[#0B0B0C]/85">
                {d.code}
              </p>
            </div>
            <h3 className="font-display mt-7 text-3xl leading-tight tracking-tight">{d.title}</h3>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#0B0B0C]/55">
              {d.subtitle}
            </p>
            <p className="mt-5 text-base leading-relaxed text-[#0B0B0C]/76">{d.text}</p>
          </div>
        ))}
      </div>

      {/* ARCHETYPES */}
      <div className="mt-32 md:mt-40">
        <div className="reveal-on-scroll max-w-2xl">
          <Eyebrow>Seven archetypes</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em]">
            How the dimensions combine.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#0B0B0C]/72 md:text-lg">
            Each leader expresses these dimensions in a unique pattern. Seven recognisable
            archetypes emerge — each with its own gifts and growth edges.
          </p>
        </div>

        <ul className="mt-16 border-y border-[#0B0B0C]/12">
          {archetypes.map((a) => (
            <li
              key={a.code}
              className="reveal-on-scroll grid grid-cols-[auto_1fr] items-baseline gap-x-8 border-b border-[#0B0B0C]/12 py-9 last:border-b-0 md:grid-cols-[10rem_1fr] md:gap-x-12 md:py-12"
            >
              <p className="font-display text-3xl leading-none tracking-[-0.02em] md:text-5xl">
                {a.code}
              </p>
              <h3 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                {a.title}
              </h3>
            </li>
          ))}
        </ul>

        <div className="reveal-on-scroll mt-16 flex flex-wrap items-center gap-x-8 gap-y-5">
          <PrimaryCTA href="/assessments">Explore assessments</PrimaryCTA>
          <TextLink href="/oql">Read the OLQ foundations</TextLink>
        </div>
      </div>
    </MarketingChrome>
  );
}
