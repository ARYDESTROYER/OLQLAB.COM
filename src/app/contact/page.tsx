import Link from "next/link";
import PublicHeader from "@/components/navigation/PublicHeader";
import { EditorialFooter } from "@/components/marketing/Editorial";
import { createPageMetadata } from "@/lib/site-metadata";
import { ContactBriefBuilder } from "./ContactBriefBuilder";
import styles from "./contact.module.css";

export const metadata = createPageMetadata({
  title: "Contact",
  description:
    "Contact OLQ Lab about leadership assessments, coaching, cohort size, goals, and programme timelines.",
  path: "/contact",
});

const briefingSignals = [
  { number: "01", label: "Cohort size", note: "Who is involved?" },
  { number: "02", label: "Leadership level", note: "Where do they lead?" },
  { number: "03", label: "Primary goal", note: "What needs to shift?" },
  { number: "04", label: "Timeline", note: "When should it begin?" },
];

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#contact-main">
        Skip to main content
      </a>
      <PublicHeader />

      <main id="contact-main" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="contact-title">
          <div className={styles.heroStatement}>
            <p className={styles.eyebrow}>
              <span aria-hidden /> Contact OLQ Lab
            </p>
            <h1 id="contact-title" className={styles.heroTitle}>
              <span>Let’s have</span>
              <span>an honest</span>
              <span className={styles.heroTitleAccent}>conversation.</span>
            </h1>
            <div className={styles.heroFooter}>
              <p>
                Tell us the shape of the leadership challenge. We will help you
                find a diagnostic and coaching track that fits the context.
              </p>
              <a className={styles.heroLink} href="#consultation-brief">
                Build a consultation brief <span aria-hidden>↘</span>
              </a>
            </div>
          </div>

          <aside className={styles.signalPanel} aria-label="What to include in your enquiry">
            <div className={styles.signalHeader}>
              <span>Useful signals</span>
              <span>01—04</span>
            </div>
            <div className={styles.signalGraphic} aria-hidden="true">
              <span className={styles.signalOrbit} />
              <span className={styles.signalCore} />
              <span className={styles.signalLine} />
            </div>
            <ol className={styles.signalList}>
              {briefingSignals.map((signal) => (
                <li key={signal.number}>
                  <span className={styles.signalNumber}>{signal.number}</span>
                  <span>
                    <strong>{signal.label}</strong>
                    <small>{signal.note}</small>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section className={styles.orientation} aria-labelledby="orientation-title">
          <div className={styles.orientationHeading}>
            <p className={styles.eyebrow}>Orientation</p>
            <h2 id="orientation-title">Start with the shape of the challenge.</h2>
          </div>
          <div className={styles.orientationCopy}>
            <p>
              A useful first conversation does not need a polished brief. Cohort
              size, leadership levels, the outcome you want, and a rough timeline
              give us enough context to ask better questions.
            </p>
          </div>
          <div className={styles.orientationGrid}>
            {briefingSignals.map((signal) => (
              <article key={signal.number}>
                <span>{signal.number}</span>
                <h3>{signal.label}</h3>
                <p>{signal.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="consultation-brief"
          className={styles.briefSection}
          aria-labelledby="brief-title"
        >
          <div className={styles.briefIntro}>
            <p className={styles.eyebrow}>Consultation brief</p>
            <h2 id="brief-title">Give the conversation a useful starting point.</h2>
            <p>
              Choose the closest options. We will place them into an email draft
              for you to review, edit, and send from your own email client.
            </p>
            <div className={styles.privacyNote}>
              <span aria-hidden>○</span>
              <p>
                Nothing entered here is stored or submitted by this website.
              </p>
            </div>
          </div>

          <noscript className={styles.noScriptSlot}>
            <div className={styles.noScriptBrief}>
              <p>
                The guided brief needs JavaScript. You can still begin with a direct email and
                add your cohort, leadership level, goal, and timeline in your own words.
              </p>
              <a href="mailto:hello@olqlab.com?subject=OLQLAB%20Consultation">
                Email hello@olqlab.com <span aria-hidden>↗</span>
              </a>
            </div>
          </noscript>

          <ContactBriefBuilder />
        </section>

        <section className={styles.pathways} aria-labelledby="pathways-title">
          <div className={styles.pathwaysHeader}>
            <p className={styles.eyebrow}>Choose your route</p>
            <h2 id="pathways-title">New programme or existing workspace?</h2>
          </div>
          <div className={styles.pathwayGrid}>
            <article className={styles.enterprisePath}>
              <div>
                <span className={styles.pathwayIndex}>01 / Enterprise programmes</span>
                <h3>Explore an assessment and coaching programme.</h3>
                <p>
                  Share the people, context, and change you are working toward.
                  We will use the first conversation to understand fit.
                </p>
              </div>
              <a
                className={styles.pathwayLinkDark}
                href="mailto:hello@olqlab.com?subject=OLQLAB%20Consultation"
              >
                Email hello@olqlab.com <span aria-hidden>↗</span>
              </a>
            </article>

            <article className={styles.clientPath}>
              <div>
                <span className={styles.pathwayIndex}>02 / Existing clients</span>
                <h3>Continue to your OLQ Lab workspace.</h3>
                <p>
                  Access your enrolled assessments, reports, and existing
                  programme workspace directly.
                </p>
              </div>
              <Link className={styles.pathwayLinkLight} href="/signin">
                Client sign in <span aria-hidden>→</span>
              </Link>
            </article>
          </div>
        </section>

        <section className={styles.directContact} aria-labelledby="direct-contact-title">
          <p className={styles.eyebrow}>Direct contact</p>
          <h2 id="direct-contact-title">Prefer a blank page?</h2>
          <a href="mailto:hello@olqlab.com?subject=OLQLAB%20Consultation">
            hello@olqlab.com <span aria-hidden>↗</span>
          </a>
        </section>
      </main>

      <EditorialFooter />
    </div>
  );
}
