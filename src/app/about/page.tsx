import Image from "next/image";
import Link from "next/link";
import ScrollMotion from "@/components/effects/ScrollMotion";
import AboutDisciplineAtlas from "@/components/marketing/AboutDisciplineAtlas";
import { EditorialFooter } from "@/components/marketing/Editorial";
import PublicHeader from "@/components/navigation/PublicHeader";
import { createPageMetadata } from "@/lib/site-metadata";
import styles from "./about.module.css";

export const metadata = createPageMetadata({
  title: "About",
  description:
    "Meet OLQ Lab and explore a leadership-development practice shaped by behavioral science, operating experience, and candid coaching.",
  path: "/about",
});

const disciplines = [
  {
    code: "culture",
    tone: "response",
    label: "Culture Diagnostic",
    description:
      "Surface the culture beneath the org chart — what is said versus what is actually done. We map the rituals, defaults, and unspoken rules so you can change the ones that no longer serve you.",
  },
  {
    code: "blindspot",
    tone: "personality",
    label: "Leadership Blindspot Coaching",
    description:
      "The patterns leaders cannot see in themselves, named and worked through. Direct, uncomfortable, kind — and rooted in behavioral science rather than personality labels.",
  },
  {
    code: "od",
    tone: "response",
    label: "Organisational Development",
    description:
      "Structure, roles, and rituals reshaped to support how people actually work. Less re-org theatre, more operating-system clarity.",
  },
  {
    code: "behavior",
    tone: "cognitive",
    label: "Behavioral Analysis",
    description:
      "Decoding what behavior signals about capability, fit, and growth potential. Evidence-based reads instead of gut calls dressed up as judgment.",
  },
  {
    code: "exec",
    tone: "personality",
    label: "Executive Coaching",
    description:
      "One-on-one work for senior leaders carrying weight that rarely lifts on its own. Confidential, high-frequency, and aimed at change you can measure.",
  },
  {
    code: "talent",
    tone: "cognitive",
    label: "Talent Management",
    description:
      "Identify, develop, and retain the people whose growth shapes the company's future. Pipelines, succession, and the patient work of building bench strength.",
  },
] as const;

const principles = [
  "Assessment-led leadership diagnostics.",
  "Blindspot clarity with coaching recommendations.",
  "Action plans aligned to role and business context.",
  "Follow-through checkpoints for sustained behavior change.",
] as const;

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <a href="#about-content" className="skip-link">
        Skip to content
      </a>
      <PublicHeader />

      <main id="about-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="about-title">
          <div className={styles.heroCopy}>
            <p className={`${styles.kicker} ${styles.heroEnter}`}>
              <span aria-hidden="true" />
              About OLQ Lab
            </p>
            <h1 id="about-title" className={styles.heroTitle}>
              <span className={styles.heroTitleLine}>
                <span>Your guide on </span>
              </span>
              <span className={styles.heroTitleLine}>
                <span>
                  the leadership path<span className={styles.period}>.</span>
                </span>
              </span>
            </h1>
            <div className={`${styles.heroIntro} ${styles.heroEnterLatest}`}>
              <p>
                Commander (Dr.) Pratap Pawar brings 35 years of leadership experience from the
                Indian Navy to corporate transformation programs.
              </p>
              <Link href="#founder-story" className={styles.inlineLink}>
                Read the founder story <span aria-hidden="true">↓</span>
              </Link>
            </div>
          </div>

          <div className={`${styles.portraitPanel} ${styles.portraitEnter}`}>
            <Image
              src="/pratap-pawar.jpg"
              alt="Commander (Dr.) Pratap Pawar speaking at a leadership event"
              fill
              priority
              sizes="(max-width: 899px) 100vw, 42vw"
              className={styles.portrait}
            />
            <div className={styles.portraitWash} aria-hidden="true" />
            <div className={styles.portraitCaption}>
              <p>Founder / OLQ Lab</p>
              <p>Command · Culture · Coaching</p>
            </div>
            <div className={styles.experienceBadge}>
              <strong>35</strong>
              <span>years lived in leadership</span>
            </div>
          </div>
        </section>

        <section className={styles.conviction} aria-labelledby="conviction-title">
          <ScrollMotion className={styles.convictionMotion}>
            <div className={`${styles.convictionInner} reveal-on-scroll`}>
              <p className={styles.sectionIndex}>01 / Orientation</p>
              <h2 id="conviction-title">
                Leadership is not about volume. It is about understanding people deeply,
                <em> including yourself.</em>
              </h2>
              <p className={styles.convictionByline}>A working conviction, not a slogan.</p>
            </div>
            <div className={styles.convictionSignals} aria-hidden="true">
              <span data-scroll-layer="far">C</span>
              <span data-scroll-layer="mid">P</span>
              <span data-scroll-layer="near">R</span>
            </div>
          </ScrollMotion>
        </section>

        <section id="founder-story" className={styles.story} aria-labelledby="story-title">
          <div className={`${styles.storyLead} reveal-on-scroll`}>
            <p className={styles.sectionIndex}>02 / Experience into practice</p>
            <h2 id="story-title">
              From command at sea to leadership in the boardroom<span className={styles.period}>.</span>
            </h2>
          </div>
          <div className={`${styles.storyBody} reveal-on-scroll`} data-stagger="1">
            <p>
              From naval operations and high-stakes command environments to multinational people
              strategy, this journey blends discipline, behavioral science, and human-centered
              leadership development.
            </p>
            <p>
              The setting changes. The essential work does not: read the situation clearly,
              understand the people inside it, and turn reflection into deliberate action.
            </p>
            <Link href="/work" className={styles.inlineLink}>
              See the work in practice <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <ScrollMotion className={styles.experienceGrid}>
            <span className={styles.experienceProgress} aria-hidden="true" />
            <article
              className={`${styles.experienceCell} reveal-on-scroll`}
              data-stagger="1"
              data-tone="cognitive"
            >
              <span>01</span>
              <p>Indian Navy</p>
              <h3>Command under pressure</h3>
              <small>Operational discipline where judgment and trust have consequences.</small>
            </article>
            <article
              className={`${styles.experienceCell} reveal-on-scroll`}
              data-stagger="2"
              data-tone="personality"
            >
              <span>02</span>
              <p>People strategy</p>
              <h3>Systems behind behavior</h3>
              <small>Multinational experience across culture, talent, and organisational change.</small>
            </article>
            <article
              className={`${styles.experienceCell} reveal-on-scroll`}
              data-stagger="3"
              data-tone="response"
            >
              <span>03</span>
              <p>OLQ Lab</p>
              <h3>Insight into practice</h3>
              <small>Assessment, candid coaching, and follow-through built around real work.</small>
            </article>
          </ScrollMotion>
        </section>

        <section className={styles.practice} aria-labelledby="practice-title">
          <div className={styles.practiceHeading}>
            <div className="reveal-on-scroll">
              <p className={styles.sectionIndex}>03 / Areas of practice</p>
              <h2 id="practice-title">
                Six disciplines<span className={styles.period}>.</span>
                <br />
                One practice<span className={styles.period}>.</span>
              </h2>
            </div>
            <p className={`${styles.practiceIntro} reveal-on-scroll`} data-stagger="1">
              Leadership does not arrive in neat categories. Select a discipline to see how each
              one connects evidence, context, and practical change.
            </p>
          </div>

          <AboutDisciplineAtlas disciplines={disciplines} />
        </section>

        <section className={styles.method} aria-labelledby="method-title">
          <div className={`${styles.methodHeading} reveal-on-scroll`}>
            <p className={styles.sectionIndex}>04 / How OLQ Lab works</p>
            <h2 id="method-title">
              A practice,
              <br />
              not a program<span className={styles.period}>.</span>
            </h2>
          </div>
          <ol className={styles.principles}>
            {principles.map((principle, index) => (
              <li
                key={principle}
                className="reveal-on-scroll"
                data-stagger={index + 1}
                data-tone={(["cognitive", "personality", "response", "integrated"] as const)[index]}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{principle}</p>
                <i aria-hidden="true">↗</i>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.cta} aria-labelledby="about-cta-title">
          <div className={`${styles.ctaCopy} reveal-on-scroll`}>
            <p className={styles.ctaIndex}>05 / Begin within</p>
            <h2 id="about-cta-title">See the patterns shaping how you lead.</h2>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/assessments" className={styles.primaryCta}>
              Explore assessments <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/signin" className={styles.secondaryCta}>
              Sign in <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>

      <EditorialFooter />
    </div>
  );
}
