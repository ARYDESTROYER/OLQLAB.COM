"use client";

import { useState } from "react";
import styles from "@/app/about/about.module.css";

type Discipline = {
  code: string;
  tone: "cognitive" | "personality" | "response";
  label: string;
  description: string;
};

export default function AboutDisciplineAtlas({
  disciplines,
}: {
  disciplines: readonly Discipline[];
}) {
  const [activeCode, setActiveCode] = useState(disciplines[0]?.code ?? "");
  const activeDiscipline =
    disciplines.find((item) => item.code === activeCode) ?? disciplines[0];

  return (
    <div
      className={styles.atlas}
      role="group"
      aria-labelledby="practice-title"
      data-tone={activeDiscipline?.tone}
    >
      <div className={styles.atlasStatus} aria-live="polite" aria-atomic="true">
        <span>Practice signal</span>
        <span className={styles.atlasToneRail} aria-hidden="true">
          <i data-tone="cognitive">C</i>
          <i data-tone="personality">P</i>
          <i data-tone="response">R</i>
        </span>
        <strong>{activeDiscipline?.label}</strong>
      </div>

      <div className={styles.atlasGrid}>
        {disciplines.map((discipline, index) => {
          const isActive = discipline.code === activeCode;

          return (
            <button
              key={discipline.code}
              type="button"
              className={styles.disciplineCard}
              data-active={isActive}
              data-tone={discipline.tone}
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
