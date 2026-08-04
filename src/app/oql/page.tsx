import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  Eyebrow,
  PrimaryCTA,
  TextLink,
} from "@/components/marketing/Editorial";
import ScrollMotion from "@/components/effects/ScrollMotion";
import OqlQualityField from "@/components/marketing/OqlQualityField";
import { createPageMetadata } from "@/lib/site-metadata";
import styles from "../marketingSignalPages.module.css";

export const metadata = createPageMetadata({
  title: "Officer-like qualities",
  description:
    "See how military-tested officer-like qualities translate into modern leadership, communication, responsibility, and adaptability.",
  path: "/oql",
});

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
      <div className="reveal-on-scroll max-w-2xl" data-reveal="rise">
        <Eyebrow>The core quality set</Eyebrow>
        <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em]">
          Twelve qualities. One leader.
        </h2>
      </div>

      <ScrollMotion className={`${styles.oqlSignal} mt-12 md:mt-16`}>
        <div className={styles.oqlTile}>
          <i data-scroll-layer="far" aria-hidden />
          <strong>O</strong>
          <span>Observe the pattern</span>
        </div>
        <div className={styles.oqlTile}>
          <i data-scroll-layer="mid" aria-hidden />
          <strong>Q</strong>
          <span>Qualities in context</span>
        </div>
        <div className={styles.oqlTile}>
          <i data-scroll-layer="near" aria-hidden />
          <strong>L</strong>
          <span>Leadership in practice</span>
        </div>
      </ScrollMotion>

      <OqlQualityField qualities={olqs} />

      {/* APPLICATION */}
      <div className="mt-32 md:mt-40">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll" data-reveal="rise">
            <Eyebrow>In application</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
              Signals, not labels.
            </h2>
          </div>
          <div>
            <p
              className="reveal-on-scroll text-base leading-relaxed text-[#101114]/82 md:text-lg"
              data-reveal="fade"
            >
              OLQLAB applies these principles as development signals, not
              labels. The focus is to improve leadership effectiveness, team
              trust, and decision quality over time.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
              <PrimaryCTA href="/framework" className="cta-shimmer">
                Read the CPR Framework
              </PrimaryCTA>
              <TextLink href="/assessments">See assessments</TextLink>
            </div>
          </div>
        </div>
      </div>
    </MarketingChrome>
  );
}
