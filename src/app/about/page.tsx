import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  Eyebrow,
  PrimaryCTA,
  TextLink,
} from "@/components/marketing/Editorial";
import HexDial from "@/components/marketing/HexDial";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "About",
  description:
    "Meet OLQ Lab and explore a leadership-development practice shaped by behavioral science, operating experience, and candid coaching.",
  path: "/about",
});

const disciplines = [
  {
    code: "culture",
    label: "Culture Diagnostic",
    description:
      "Surface the culture beneath the org chart — what is said versus what is actually done. We map the rituals, defaults, and unspoken rules so you can change the ones that no longer serve you.",
  },
  {
    code: "blindspot",
    label: "Leadership Blindspot Coaching",
    description:
      "The patterns leaders cannot see in themselves, named and worked through. Direct, uncomfortable, kind — and rooted in behavioral science rather than personality labels.",
  },
  {
    code: "od",
    label: "Organisational Development",
    description:
      "Structure, roles, and rituals reshaped to support how people actually work. Less re-org theatre, more operating-system clarity.",
  },
  {
    code: "behavior",
    label: "Behavioral Analysis",
    description:
      "Decoding what behavior signals about capability, fit, and growth potential. Evidence-based reads instead of gut calls dressed up as judgment.",
  },
  {
    code: "exec",
    label: "Executive Coaching",
    description:
      "One-on-one work for senior leaders carrying weight that rarely lifts on its own. Confidential, high-frequency, and aimed at change you can measure.",
  },
  {
    code: "talent",
    label: "Talent Management",
    description:
      "Identify, develop, and retain the people whose growth shapes the company's future. Pipelines, succession, and the patient work of building bench strength.",
  },
];

const principles = [
  "Assessment-led leadership diagnostics.",
  "Blindspot clarity with coaching recommendations.",
  "Action plans aligned to role and business context.",
  "Follow-through checkpoints for sustained behavior change.",
];

export default function AboutPage() {
  return (
    <MarketingChrome
      eyebrow="About"
      title="Your guide on the leadership path."
      description="Commander (Dr.) Pratap Pawar brings 35 years of leadership experience from the Indian Navy to corporate transformation programs."
    >
      {/* FOUNDER STORY */}
      <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
        <div className="reveal-on-scroll">
          <Eyebrow>Founder story</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
            From command at sea to leadership in the boardroom
            <span className="brass-period">.</span>
          </h2>
        </div>
        <div>
          <p className="reveal-on-scroll text-base leading-relaxed text-[#101114]/78 md:text-lg">
            From naval operations and high-stakes command environments to multinational people
            strategy, this journey blends discipline, behavioral science, and human-centered
            leadership development.
          </p>
          <blockquote
            className="reveal-on-scroll mt-10 border-l-2 pl-6 font-display text-[clamp(1.4rem,2.6vw,2.2rem)] leading-[1.22] tracking-[-0.01em]"
            style={{ borderLeftColor: "#A6824A" }}
          >
            &ldquo;Leadership is not about volume. It is about understanding people deeply,
            including yourself.&rdquo;
          </blockquote>
        </div>
      </div>

      {/* EXPERTISE — interactive hex dial */}
      <div className="mt-32 md:mt-40">
        <div className="reveal-on-scroll max-w-2xl">
          <Eyebrow>Areas of practice</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
            Six disciplines, one practice
            <span className="brass-period">.</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#101114]/72 md:text-lg">
            Six disciplines, all feeding into a single practice. Hover any vertex of the
            hexagon to see what we work on inside it.
          </p>
        </div>

        <div className="mt-16 md:mt-24">
          <HexDial
            disciplines={disciplines}
            defaultIndex={0}
            centerLabel="Practice"
            hint="Hover or tap any node."
          />
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="mt-32 md:mt-40">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll">
            <Eyebrow>How OLQLAB works</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
              A practice, not a program
              <span className="brass-period">.</span>
            </h2>
          </div>
          <ol className="border-y border-[#101114]/12 md:border-t-0">
            {principles.map((item, i) => (
              <li
                key={item}
                className="reveal-on-scroll grid grid-cols-[auto_1fr] items-baseline gap-x-6 border-b border-[#101114]/12 py-8 last:border-b-0 md:gap-x-10 md:py-10"
              >
                <span className="font-display text-2xl text-[#101114]/35 md:text-3xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-base leading-relaxed text-[#101114]/82 md:text-lg">{item}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="reveal-on-scroll mt-16 flex flex-wrap items-center gap-x-8 gap-y-5">
          <PrimaryCTA href="/signin" className="cta-shimmer">
            Sign in
          </PrimaryCTA>
          <TextLink href="/assessments">Explore assessments</TextLink>
        </div>
      </div>
    </MarketingChrome>
  );
}
