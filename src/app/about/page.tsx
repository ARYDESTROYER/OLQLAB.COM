import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  Eyebrow,
  PrimaryCTA,
  TextLink,
} from "@/components/marketing/Editorial";

const expertise = [
  "Culture Diagnostic",
  "Leadership Blindspot Coaching",
  "Organisational Development",
  "Behavioral Analysis",
  "Executive Coaching",
  "Talent Management",
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
            From command at sea to leadership in the boardroom.
          </h2>
        </div>
        <div>
          <p className="reveal-on-scroll text-base leading-relaxed text-[#0B0B0C]/78 md:text-lg">
            From naval operations and high-stakes command environments to multinational people
            strategy, this journey blends discipline, behavioral science, and human-centered
            leadership development.
          </p>
          <blockquote className="reveal-on-scroll mt-10 border-l border-[#0B0B0C] pl-6 font-display text-[clamp(1.4rem,2.6vw,2.2rem)] leading-[1.22] tracking-[-0.01em]">
            &ldquo;Leadership is not about volume. It is about understanding people deeply,
            including yourself.&rdquo;
          </blockquote>
        </div>
      </div>

      {/* EXPERTISE */}
      <div className="mt-32 md:mt-40">
        <div className="reveal-on-scroll max-w-2xl">
          <Eyebrow>Areas of practice</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
            Six disciplines, one practice.
          </h2>
        </div>
        <ul className="mt-14 border-y border-[#0B0B0C]/12">
          {expertise.map((item, i) => (
            <li
              key={item}
              className="reveal-on-scroll grid grid-cols-[auto_1fr] items-baseline gap-6 border-b border-[#0B0B0C]/12 py-7 last:border-b-0 md:gap-10 md:py-9"
            >
              <span className="font-display text-2xl text-[#0B0B0C]/35 md:text-3xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-xl leading-tight tracking-tight md:text-2xl">
                {item}
              </h3>
            </li>
          ))}
        </ul>
      </div>

      {/* HOW IT WORKS */}
      <div className="mt-32 md:mt-40">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll">
            <Eyebrow>How OLQLAB works</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
              A practice, not a program.
            </h2>
          </div>
          <ol className="border-y border-[#0B0B0C]/12 md:border-t-0">
            {principles.map((item, i) => (
              <li
                key={item}
                className="reveal-on-scroll grid grid-cols-[auto_1fr] items-baseline gap-x-6 border-b border-[#0B0B0C]/12 py-8 last:border-b-0 md:gap-x-10 md:py-10"
              >
                <span className="font-display text-2xl text-[#0B0B0C]/35 md:text-3xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-base leading-relaxed text-[#0B0B0C]/82 md:text-lg">{item}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="reveal-on-scroll mt-16 flex flex-wrap items-center gap-x-8 gap-y-5">
          <PrimaryCTA href="/signin">Sign in</PrimaryCTA>
          <TextLink href="/assessments">Explore assessments</TextLink>
        </div>
      </div>
    </MarketingChrome>
  );
}
