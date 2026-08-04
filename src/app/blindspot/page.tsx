import Link from "next/link";
import PublicHeader from "@/components/navigation/PublicHeader";
import MarketingEffects from "@/components/marketing/MarketingEffects";
import {
  EditorialFooter,
  Eyebrow,
  GhostCTA,
  PrimaryCTA,
} from "@/components/marketing/Editorial";
import { createPageMetadata } from "@/lib/site-metadata";
import { BlindspotField } from "./BlindspotField";
import styles from "./blindspot.module.css";

export const metadata = createPageMetadata({
  title: "Leadership blindspot work",
  description:
    "Surface hidden leadership behaviors, decision habits, and intent-impact gaps, then turn them into practical next moves.",
  path: "/blindspot",
});

const outcomes = [
  {
    code: "01",
    title: "Hidden behaviors",
    body: "Patterns that quietly reduce team trust without anyone naming them.",
    tone: "teal",
  },
  {
    code: "02",
    title: "Risky decision habits",
    body: "The defaults that create avoidable execution risk under pressure.",
    tone: "amber",
  },
  {
    code: "03",
    title: "Intent-impact gaps",
    body: "Communication that lands differently than it was meant to.",
    tone: "terracotta",
  },
  {
    code: "04",
    title: "Practical next moves",
    body: "Role-specific actions that reduce repeated leadership friction.",
    tone: "ink",
  },
] as const;

const practice = [
  {
    code: "N",
    title: "Notice",
    body: "Make the pattern observable—without turning one difficult moment into a verdict on the person.",
  },
  {
    code: "A",
    title: "Name",
    body: "Separate intent from impact and find the conditions that make the pattern more likely to repeat.",
  },
  {
    code: "P",
    title: "Practise",
    body: "Choose a specific response to rehearse, apply, and review in the work that is already happening.",
  },
] as const;

export default function BlindspotPage() {
  return (
    <div className={styles.page}>
      <MarketingEffects />
      <a className={styles.skipLink} href="#blindspot-content">
        Skip to main content
      </a>
      <PublicHeader />

      <main id="blindspot-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="blindspot-title">
          <div className={styles.heroCopy}>
            <div className={styles.heroSpectrum} aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <Eyebrow className={styles.heroEyebrow} tone="light">
              Blindspot work
            </Eyebrow>
            <h1 id="blindspot-title" className={styles.heroTitle}>
              What you cannot see
              <em> still shapes the room.</em>
            </h1>
            <p className={styles.heroLede}>
              See what is hard to see alone—then convert that insight into practical
              behavior shifts.
            </p>
            <div className={styles.heroActions}>
              <GhostCTA href="/contact">Explore a blindspot sprint</GhostCTA>
              <a className={styles.fieldLink} href="#perception-field">
                Enter the perception field
                <span aria-hidden>↓</span>
              </a>
            </div>
          </div>

          <BlindspotField />
        </section>

        <section className={styles.outcomes} aria-labelledby="outcomes-title">
          <div className={styles.sectionLead}>
            <div className="reveal-on-scroll">
              <Eyebrow>What becomes visible</Eyebrow>
              <h2 id="outcomes-title" className={styles.sectionTitle}>
                Clarity is useful only when it changes the next move.
              </h2>
            </div>
            <p className={`${styles.sectionIntro} reveal-on-scroll`} data-stagger="1">
              The work turns an indistinct sense that something is off into a pattern
              a leader can examine, discuss, and act on.
            </p>
          </div>

          <ol className={styles.outcomeGrid}>
            {outcomes.map((outcome, index) => (
              <li
                key={outcome.title}
                className={`${styles.outcomeCard} ${styles[outcome.tone]} reveal-on-scroll`}
                data-stagger={index + 1}
              >
                <span className={styles.outcomeCode}>{outcome.code}</span>
                <h3>{outcome.title}</h3>
                <p>{outcome.body}</p>
                <span className={styles.outcomeSignal} aria-hidden />
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.gapSection} aria-labelledby="gap-title">
          <div className={`${styles.gapHeading} reveal-on-scroll`}>
            <Eyebrow tone="light">The useful gap</Eyebrow>
            <h2 id="gap-title">
              Intent is only half
              <span> the signal.</span>
            </h2>
          </div>
          <div className={styles.gapComparison}>
            <article className={`${styles.gapPanel} ${styles.intentPanel} reveal-on-scroll`}>
              <span className={styles.panelIndex}>01 / INTENT</span>
              <p className={styles.panelStatement}>“I was creating clarity.”</p>
              <p className={styles.panelNote}>
                The purpose a leader can explain from inside the decision.
              </p>
            </article>
            <article
              className={`${styles.gapPanel} ${styles.impactPanel} reveal-on-scroll`}
              data-stagger="1"
            >
              <span className={styles.panelIndex}>02 / IMPACT</span>
              <p className={styles.panelStatement}>“There was no room to question it.”</p>
              <p className={styles.panelNote}>
                The experience other people may be responding to in the room.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.practice} aria-labelledby="practice-title">
          <div className={`${styles.practiceLead} reveal-on-scroll`}>
            <Eyebrow>From awareness to practice</Eyebrow>
            <h2 id="practice-title" className={styles.sectionTitle}>
              Do not stop at the reveal.
            </h2>
            <p>
              Insight becomes development when it is made specific enough to test in
              real decisions, conversations, and moments of pressure.
            </p>
          </div>
          <ol className={styles.practiceSteps}>
            {practice.map((step, index) => (
              <li key={step.title} className="reveal-on-scroll" data-stagger={index + 1}>
                <span className={styles.practiceCode}>{step.code}</span>
                <div>
                  <span className={styles.practiceIndex}>0{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.cta} aria-labelledby="sprint-title">
          <div className={styles.ctaInner}>
            <div className="reveal-on-scroll">
              <Eyebrow>Run a sprint</Eyebrow>
              <h2 id="sprint-title">
                For the leaders stepping into more<span>.</span>
              </h2>
            </div>
            <div className={styles.ctaAside}>
              <p className="reveal-on-scroll" data-stagger="1">
                Ideal for leaders stepping into expanded scope, post-reorg
                transitions, or high-stakes performance cycles.
              </p>
              <div className={styles.ctaActions}>
                <PrimaryCTA href="/contact">Book a consultation</PrimaryCTA>
                <Link href="/signin">Or sign in</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <EditorialFooter />
    </div>
  );
}
