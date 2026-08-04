import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  Eyebrow,
  PrimaryCTA,
  TextLink,
} from "@/components/marketing/Editorial";
import StepperFlow from "@/components/marketing/StepperFlow";
import CoachingJourney from "@/components/marketing/CoachingJourney";
import { createPageMetadata } from "@/lib/site-metadata";
import styles from "../marketingSignalPages.module.css";

export const metadata = createPageMetadata({
  title: "Leadership coaching",
  description:
    "Convert assessment insight into sustained leadership behavior through diagnostic, blindspot, action, and recalibration work.",
  path: "/coaching",
});

const steps = [
  {
    code: "diagnostic",
    label: "Diagnostic",
    description:
      "Assessment and leadership interview to surface the patterns at play.",
    outcome: "A shared evidence baseline",
    deliverable:
      "Assessment and interview signals brought into one view before interpretation begins.",
  },
  {
    code: "blindspot",
    label: "Blindspot mapping",
    description:
      "Behavior-pattern readout that names what you couldn't quite see alone.",
    outcome: "A pattern the room can name",
    deliverable:
      "A clear account of the behavior, its conditions, and the difference between intent and impact.",
  },
  {
    code: "plan",
    label: "Coaching plan",
    description:
      "Role-aligned plan with concrete action commitments — not abstractions.",
    outcome: "Commitments close to the work",
    deliverable:
      "A deliberately small set of practices tied to real decisions, conversations, and pressure points.",
  },
  {
    code: "recalibration",
    label: "Recalibration",
    description:
      "Follow-up checkpoints, honest measurement, growth recalibrated.",
    outcome: "Evidence of what changed",
    deliverable:
      "A review of visible shifts, persistent friction, and the next adjustment worth making.",
  },
];

export default function CoachingPage() {
  return (
    <MarketingChrome
      eyebrow="Coaching"
      title="From insight to behavior."
      description="High-touch coaching engagements that convert assessment insight into sustained leadership behavior change."
    >
      {/* COACHING STRUCTURE — interactive stepper */}
      <div className="reveal-on-scroll max-w-2xl" data-reveal="rise">
        <Eyebrow>The structure</Eyebrow>
        <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
          Four stages, one engagement
          <span className="brass-period">.</span>
        </h2>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[#101114]/72 md:text-lg">
          Choose any stage of the engagement to read what happens at that step.
        </p>
      </div>

      <div className={`${styles.coachingStage} mt-16 md:mt-24`}>
        <StepperFlow stages={steps} defaultIndex={0} />
      </div>

      <CoachingJourney stages={steps} />

      {/* BEST FIT */}
      <div className="mt-32 md:mt-40">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll" data-reveal="rise">
            <Eyebrow>Best fit</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
              Where this work pays off
              <span className="brass-period">.</span>
            </h2>
          </div>
          <div>
            <p
              className="reveal-on-scroll text-base leading-relaxed text-[#101114]/82 md:text-lg"
              data-reveal="fade"
            >
              Designed for senior leaders, managers, and succession-candidate
              cohorts where behavioral shift needs to be measurable and
              role-relevant.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
              <PrimaryCTA href="/contact" className="cta-shimmer">
                Request a coaching plan
              </PrimaryCTA>
              <TextLink href="/assessments">View assessments</TextLink>
            </div>
          </div>
        </div>
      </div>
    </MarketingChrome>
  );
}
