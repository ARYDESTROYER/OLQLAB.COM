import Image from "next/image";
import Link from "next/link";
import ScrollMotion from "@/components/effects/ScrollMotion";
import {
  EditorialFooter,
  Eyebrow,
  PrimaryCTA,
} from "@/components/marketing/Editorial";
import PublicHeader from "@/components/navigation/PublicHeader";
import { WORK_EVENTS, WORK_IMAGES, type WorkImage } from "@/content/work-events";
import { createPageMetadata } from "@/lib/site-metadata";
import styles from "./work.module.css";

export const metadata = createPageMetadata({
  title: "Work in practice",
  description:
    "See OLQ Lab leadership workshops, cohort programmes, and experiential development work in practice.",
  path: "/work",
});

function WorkFigure({
  image,
  sizes,
}: {
  image: WorkImage;
  sizes: string;
}) {
  return (
    <figure
      className={styles.figure}
      data-reveal-item
      data-orientation={image.orientation ?? "landscape"}
    >
      <div className={styles.imageFrame}>
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          className={styles.image}
          style={{ objectPosition: image.objectPosition }}
        />
      </div>
      <figcaption>{image.caption}</figcaption>
    </figure>
  );
}

export default function WorkPage() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#work-content">
        Skip to content
      </a>
      <PublicHeader />

      <main id="work-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="work-title">
          <div className={styles.heroCopy}>
            <ScrollMotion className={styles.heroMotion}>
              <div className={styles.heroGeometry} aria-hidden>
                <span data-scroll-layer="far" data-tone="cognitive" />
                <span data-scroll-layer="mid" data-tone="personality" />
                <span data-scroll-layer="near" data-tone="response" />
              </div>
            </ScrollMotion>
            <div className={styles.heroSignals} aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div
              className={`${styles.heroContent} reveal-on-scroll`}
              data-reveal="rise"
            >
              <Eyebrow>Work in practice</Eyebrow>
              <h1 id="work-title">
                Leadership becomes visible
                <em> in the room.</em>
              </h1>
              <p>
                Workshops, cohorts, and experiential labs where people can see
                the pattern, test another response, and carry something useful
                back into the work.
              </p>
              <a className={styles.heroLink} href="#field-notes">
                Explore the field notes
                <span aria-hidden>↓</span>
              </a>
            </div>
          </div>

          <figure
            className={`${styles.heroFigure} reveal-on-scroll`}
            data-reveal="wipe"
          >
            <Image
              src={WORK_IMAGES.learningThroughAction.src}
              alt={WORK_IMAGES.learningThroughAction.alt}
              fill
              priority
              sizes="(min-width: 900px) 52vw, 100vw"
              className={styles.heroImage}
              style={{
                objectPosition: WORK_IMAGES.learningThroughAction.objectPosition,
              }}
            />
            <figcaption>
              <span>IN PRACTICE / 2024</span>
              <strong>Learning through action</strong>
            </figcaption>
          </figure>
        </section>

        <section className={styles.orientation} aria-labelledby="orientation-title">
          <div className={`${styles.orientationCopy} reveal-on-scroll`} data-reveal="rise">
            <p className={styles.sectionCode}>01 / THE WORK</p>
            <h2 id="orientation-title">
              Not a performance.
              <em> A practice.</em>
            </h2>
          </div>
          <div className={`${styles.orientationBody} reveal-on-scroll`} data-reveal="fade">
            <p>
              Every format changes with the room. The constant is a disciplined
              cycle: notice what is happening, make the pattern discussable,
              practise a different response, and review what changed.
            </p>
            <dl>
              <div>
                <dt>{WORK_EVENTS.length}</dt>
                <dd>field notes</dd>
              </div>
              <div>
                <dt>3</dt>
                <dd>learning formats</dd>
              </div>
              <div>
                <dt>1</dt>
                <dd>shared discipline</dd>
              </div>
            </dl>
          </div>
        </section>

        <nav className={styles.eventIndex} aria-label="Work in practice field notes">
          <p>FIELD NOTE INDEX</p>
          <ol>
            {WORK_EVENTS.map((event) => (
              <li key={event.slug} data-tone={event.tone}>
                <a href={`#${event.slug}`}>
                  <span>{event.index}</span>
                  <strong>{event.eyebrow}</strong>
                  <span aria-hidden>↓</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <section
          id="field-notes"
          className={styles.events}
          aria-label="Leadership work in practice"
        >
          {WORK_EVENTS.map((event) => (
            <article
              id={event.slug}
              className={styles.event}
              data-work-event
              data-tone={event.tone}
              key={event.slug}
              aria-labelledby={`${event.slug}-title`}
            >
              <div className={styles.eventInner}>
                <header
                  className={styles.eventHeader}
                  data-reveal-group="assembly"
                >
                  <div className={styles.eventIdentity} data-reveal-item>
                    <span>{event.index}</span>
                    <p>{event.eyebrow}</p>
                  </div>
                  <div className={styles.eventCopy} data-reveal-item>
                    <h2 id={`${event.slug}-title`}>{event.title}</h2>
                    <p>{event.description}</p>
                  </div>
                  <dl className={styles.eventMeta} data-reveal-item>
                    <div>
                      <dt>When</dt>
                      <dd>
                        <time dateTime={event.dateTime}>{event.dateLabel}</time>
                      </dd>
                    </div>
                    <div>
                      <dt>Where</dt>
                      <dd>{event.location}</dd>
                    </div>
                    <div>
                      <dt>Format</dt>
                      <dd>{event.format}</dd>
                    </div>
                  </dl>
                </header>

                <div
                  className={styles.gallery}
                  data-layout={event.layout}
                  data-reveal-group="mask"
                >
                  {event.images.map((image) => (
                    <WorkFigure
                      key={image.src}
                      image={image}
                      sizes={
                        event.layout === "single"
                          ? "(min-width: 1440px) 1344px, (min-width: 768px) 92vw, 100vw"
                          : "(min-width: 1024px) 48vw, (min-width: 640px) 50vw, 100vw"
                      }
                    />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className={styles.closing} aria-labelledby="work-closing-title">
          <div className="reveal-on-scroll" data-reveal="wipe">
            <p className={styles.sectionCode}>05 / YOUR ROOM</p>
            <h2 id="work-closing-title">
              Bring the practice
              <em> into your context.</em>
            </h2>
          </div>
          <div className={`${styles.closingAction} reveal-on-scroll`} data-reveal="rise">
            <p>
              Tell us what the room is carrying. We will shape the diagnostic,
              workshop, or coaching track around the work that needs to move.
            </p>
            <PrimaryCTA href="/contact" className={styles.closingPrimary}>
              Start a conversation
            </PrimaryCTA>
            <Link href="/assessments">Explore assessments →</Link>
          </div>
        </section>
      </main>

      <EditorialFooter />
    </div>
  );
}
