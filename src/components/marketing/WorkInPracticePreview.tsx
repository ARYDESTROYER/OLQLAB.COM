import Image from "next/image";
import Link from "next/link";
import ScrollMotion from "@/components/effects/ScrollMotion";
import { Eyebrow } from "@/components/marketing/Editorial";
import { WORK_IMAGES } from "@/content/work-events";
import styles from "./WorkInPracticePreview.module.css";

const previewImages = [
  {
    image: WORK_IMAGES.solutionMindsetCampus,
    code: "01 / IN THE ROOM",
    place: "Campus leadership lab · Kopargaon",
    size: "landscape",
    sizes: "(min-width: 1024px) 38vw, (min-width: 640px) 44vw, 100vw",
  },
  {
    image: WORK_IMAGES.learningThroughAction,
    code: "02 / IN PRACTICE",
    place: "Experiential workshop · July 2024",
    size: "portrait",
    sizes: "(min-width: 1024px) 30vw, (min-width: 640px) 44vw, 100vw",
  },
] as const;

export default function WorkInPracticePreview() {
  return (
    <section className={styles.section} aria-labelledby="work-preview-title">
      <ScrollMotion className={styles.motionField}>
        <div className={styles.motionBlocks} aria-hidden>
          <span data-scroll-layer="far" data-block="cognitive" />
          <span data-scroll-layer="mid" data-block="personality" />
          <span data-scroll-layer="near" data-block="response" />
        </div>
      </ScrollMotion>

      <div className={styles.signalRail} aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div className={styles.inner}>
        <div className={`${styles.copy} reveal-on-scroll`} data-reveal="rise">
          <Eyebrow>Inside the work</Eyebrow>
          <h2 id="work-preview-title">
            Leadership becomes visible
            <em> in the room.</em>
          </h2>
          <p>
            The framework matters when people can test it against a real
            conversation, a live decision, and the way a team responds under
            pressure.
          </p>
          <Link href="/work" className={styles.link}>
            Explore work in practice
            <span aria-hidden>↗</span>
          </Link>
        </div>

        <div
          className={styles.diptych}
          data-reveal-group="mask"
          aria-label="OLQ Lab workshops in practice"
        >
          {previewImages.map(({ image, code, place, size, sizes }) => (
            <figure
              className={styles.figure}
              data-reveal-item
              data-size={size}
              key={image.src}
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
              <figcaption>
                <span>{code}</span>
                <strong>{place}</strong>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
