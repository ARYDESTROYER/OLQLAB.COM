import ScrollMotion from "@/components/effects/ScrollMotion";
import type { CSSProperties } from "react";
import styles from "./OqlQualityField.module.css";

export default function OqlQualityField({
  qualities,
}: {
  qualities: readonly string[];
}) {
  return (
    <ScrollMotion className={styles.field}>
      <div className={styles.frameHeader} aria-hidden>
        <span>Leadership quality field</span>
        <span>12 observable signals</span>
      </div>

      <span
        className={`${styles.artifact} ${styles.artifactO}`}
        data-scroll-layer="far"
        aria-hidden
      >
        O
      </span>
      <span
        className={`${styles.artifact} ${styles.artifactQ}`}
        data-scroll-layer="mid"
        aria-hidden
      >
        Q
      </span>
      <span
        className={`${styles.artifact} ${styles.artifactL}`}
        data-scroll-layer="near"
        aria-hidden
      >
        L
      </span>

      <ol className={styles.grid} data-reveal-group="assembly">
        {qualities.map((quality, index) => (
          <li
            className={styles.card}
            data-reveal-item
            key={quality}
            style={{ "--quality-index": index } as CSSProperties}
          >
            <span className={styles.index}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={styles.signalDot} aria-hidden />
            <h3>{quality}</h3>
          </li>
        ))}
      </ol>

      <div className={styles.progress} aria-hidden>
        <span />
      </div>
    </ScrollMotion>
  );
}
