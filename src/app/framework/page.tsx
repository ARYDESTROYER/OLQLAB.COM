import Link from "next/link";
import ScrollMotion from "@/components/effects/ScrollMotion";
import { EditorialFooter } from "@/components/marketing/Editorial";
import FrameworkExperience from "@/components/marketing/FrameworkExperience";
import PublicHeader from "@/components/navigation/PublicHeader";
import { createPageMetadata } from "@/lib/site-metadata";
import styles from "./FrameworkPage.module.css";

export const metadata = createPageMetadata({
  title: "CPR leadership framework",
  description:
    "Explore OLQ Lab's Cognitive, Personality, and Response framework for understanding leadership behavior and growth.",
  path: "/framework",
});

const dimensions = [
  { numeral: "I", code: "C", title: "Cognitive", prompt: "How you think" },
  { numeral: "II", code: "P", title: "Personality", prompt: "How you engage" },
  { numeral: "III", code: "R", title: "Response", prompt: "How you adapt" },
] as const;

export default function FrameworkPage() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#framework-content">
        Skip to framework content
      </a>
      <PublicHeader />

      <main id="framework-content" tabIndex={-1}>
        <ScrollMotion className={styles.heroMotion}>
          <section className={styles.hero} aria-labelledby="framework-title">
            <div className={styles.heroGrid}>
              <div className={styles.heroLead}>
                <div className={styles.heroSignalField} aria-hidden="true">
                  <span data-scroll-layer="far" />
                  <span data-scroll-layer="mid" />
                  <span data-scroll-layer="near" />
                </div>
                <p className={styles.eyebrow}>
                  <span aria-hidden /> Framework / CPR
                </p>
                <h1 id="framework-title" className={`font-display ${styles.heroTitle}`}>
                  Composite
                  <span>Pattern Recognition.</span>
                </h1>
              </div>

              <div className={styles.heroAside}>
                <p className={styles.sectionIndex}>01 / Orientation</p>
                <p className={`font-display ${styles.heroStatement}`}>
                  Leadership becomes clearer when thinking, engagement, and adaptation are read
                  as one pattern.
                </p>
                <p className={styles.heroDescription}>
                  CPR is OLQ Lab&apos;s practical lens for seeing how a leader processes complexity,
                  influences people, and responds when conditions change.
                </p>
                <div className={styles.heroLinks}>
                  <Link className={styles.inkLink} href="/assessments">
                    Explore assessments <span aria-hidden>↗</span>
                  </Link>
                  <Link className={styles.ruleLink} href="/oql">
                    OLQ foundations <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className={styles.dimensionSignal} aria-label="The three CPR dimensions">
              {dimensions.map((dimension, index) => (
                <article className={styles.signalCell} key={dimension.code}>
                  <span className={styles.signalNumeral}>{dimension.numeral}</span>
                  <span className={`font-display ${styles.signalCode}`} aria-hidden>
                    {dimension.code}
                  </span>
                  <div>
                    <h2>{dimension.title}</h2>
                    <p>{dimension.prompt}</p>
                  </div>
                  <span className={styles.signalPosition} aria-hidden>
                    0{index + 1}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </ScrollMotion>

        <section className={styles.introduction} aria-labelledby="framework-introduction">
          <p className={`${styles.sectionIndex} reveal-on-scroll`}>02 / The model</p>
          <div className="reveal-on-scroll" data-stagger="1">
            <h2 id="framework-introduction" className={`font-display ${styles.sectionTitle}`}>
              Three signals.
              <br />
              One leadership pattern.
            </h2>
          </div>
          <div className={`${styles.introductionCopy} reveal-on-scroll`} data-stagger="2">
            <p>
              Most leadership tools isolate traits. Composite Pattern Recognition reads the
              relationship between dimensions: where a leader is naturally strong, where a
              strength can become overused, and what the situation is asking them to practise
              next.
            </p>
            <p>
              The result is not a fixed label. It is a useful orientation for more deliberate
              behaviour.
            </p>
          </div>
        </section>

        <FrameworkExperience />

        <section className={styles.closing} aria-labelledby="framework-closing-title">
          <div className={`${styles.closingMark} reveal-on-scroll`} aria-hidden>
            <span data-stagger="1">C</span>
            <span data-stagger="2">P</span>
            <span data-stagger="3">R</span>
          </div>
          <div className={styles.closingCopy}>
            <p className={`${styles.closingIndex} reveal-on-scroll`}>04 / Put the pattern to work</p>
            <h2 id="framework-closing-title" className={`font-display ${styles.closingTitle} reveal-on-scroll`}>
              See the pattern.
              <br />
              Choose the practice.
            </h2>
            <p className="reveal-on-scroll">
              An OLQ Lab assessment turns CPR into a focused development conversation — with
              strengths to use deliberately and growth edges to address in context.
            </p>
            <div className={styles.closingLinks}>
              <Link className={styles.lightLink} href="/assessments">
                Find an assessment <span aria-hidden>↗</span>
              </Link>
              <Link className={styles.lightRuleLink} href="/oql">
                Read the OLQ foundations <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <EditorialFooter />
    </div>
  );
}
