"use client";

import { useState } from "react";
import styles from "@/app/about/about.module.css";

type Discipline = {
  code: string;
  label: string;
  description: string;
};

export default function AboutDisciplineAtlas({
  disciplines,
}: {
  disciplines: readonly Discipline[];
}) {
  const [activeCode, setActiveCode] = useState(disciplines[0]?.code ?? "");

  return (
    <div className={styles.atlas} role="group" aria-labelledby="practice-title">
      <div className={styles.atlasStatus} aria-live="polite" aria-atomic="true">
        <span>Practice signal</span>
        <strong>{disciplines.find((item) => item.code === activeCode)?.label}</strong>
      </div>

      <div className={styles.atlasGrid}>
        {disciplines.map((discipline, index) => {
          const isActive = discipline.code === activeCode;

          return (
            <button
              key={discipline.code}
              type="button"
              className={`${styles.disciplineCard} reveal-on-scroll`}
              data-active={isActive}
              data-stagger={index + 1}
              aria-pressed={isActive}
              onClick={() => setActiveCode(discipline.code)}
              onFocus={() => setActiveCode(discipline.code)}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setActiveCode(discipline.code);
              }}
            >
              <span className={styles.disciplineNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.disciplineMarker} aria-hidden="true" />
              <strong>{discipline.label}</strong>
              <span className={styles.disciplineDescription}>{discipline.description}</span>
              <span className={styles.disciplineAction} aria-hidden="true">
                {isActive ? "Selected" : "Explore"} <i>↗</i>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
