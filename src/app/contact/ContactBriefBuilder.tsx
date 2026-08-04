"use client";

import { useMemo, useState } from "react";
import styles from "./contact.module.css";

type BriefKey = "cohort" | "level" | "goal" | "timeline";

type BriefState = Record<BriefKey, string>;

type BriefQuestion = {
  key: BriefKey;
  number: string;
  legend: string;
  prompt: string;
  options: string[];
};

const questions: BriefQuestion[] = [
  {
    key: "cohort",
    number: "01",
    legend: "Cohort size",
    prompt: "Approximately how many leaders are involved?",
    options: ["Up to 15", "16–40", "41–100", "More than 100", "Not sure yet"],
  },
  {
    key: "level",
    number: "02",
    legend: "Leadership level",
    prompt: "Which leadership population is the closest fit?",
    options: [
      "Emerging leaders",
      "Mid-level leaders",
      "Senior or executive leaders",
      "A mixed cohort",
      "Not sure yet",
    ],
  },
  {
    key: "goal",
    number: "03",
    legend: "Primary goal",
    prompt: "What would you most like the work to unlock?",
    options: [
      "A leadership baseline",
      "Blindspot clarity",
      "A coaching programme",
      "Organisational change",
      "Explore the right approach",
    ],
  },
  {
    key: "timeline",
    number: "04",
    legend: "Timeline",
    prompt: "When would you ideally begin?",
    options: [
      "Within four weeks",
      "In one to three months",
      "In three to six months",
      "We are still exploring",
    ],
  },
];

const initialBrief: BriefState = {
  cohort: "",
  level: "",
  goal: "",
  timeline: "",
};

const questionTones = ["cognitive", "personality", "response", "integrated"] as const;

function buildMailto(brief: BriefState) {
  const selected = (key: BriefKey) => brief[key] || "Not specified yet";
  const body = [
    "Hello OLQ Lab,",
    "",
    "I would like to discuss a leadership programme.",
    "",
    `Cohort size: ${selected("cohort")}`,
    `Leadership level: ${selected("level")}`,
    `Primary goal: ${selected("goal")}`,
    `Preferred timeline: ${selected("timeline")}`,
    "",
    "Additional context:",
    "",
    "",
    "Best regards,",
  ].join("\n");

  return `mailto:hello@olqlab.com?subject=${encodeURIComponent(
    "OLQLAB Consultation",
  )}&body=${encodeURIComponent(body)}`;
}

export function ContactBriefBuilder() {
  const [brief, setBrief] = useState<BriefState>(initialBrief);
  const completed = Object.values(brief).filter(Boolean).length;
  const mailto = useMemo(() => buildMailto(brief), [brief]);

  const updateBrief = (key: BriefKey, value: string) => {
    setBrief((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className={styles.builder}>
      <div className={styles.builderProgress} aria-live="polite">
        <span>Brief progress</span>
        <span className={styles.progressCount}>
          <strong>{completed}</strong> / {questions.length} signals
        </span>
        <span
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Consultation brief completion"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={completed}
        >
          <span style={{ width: `${(completed / questions.length) * 100}%` }} />
        </span>
      </div>

      <div className={styles.questionList}>
        {questions.map((question, index) => (
          <fieldset
            key={question.key}
            className={styles.question}
            data-tone={questionTones[index]}
            data-complete={Boolean(brief[question.key])}
            aria-describedby={`brief-${question.key}-prompt`}
          >
            <legend className={styles.questionLegend}>
              <span className={styles.questionLegendInner}>
                <span>{question.number}</span>
                <span>{question.legend}</span>
              </span>
            </legend>
            <p id={`brief-${question.key}-prompt`}>{question.prompt}</p>
            <div className={styles.options}>
              {question.options.map((option) => (
                <label key={option} className={styles.option}>
                  <input
                    type="radio"
                    name={question.key}
                    value={option}
                    checked={brief[question.key] === option}
                    onChange={(event) => updateBrief(question.key, event.target.value)}
                  />
                  <span className={styles.optionMark} aria-hidden="true" />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className={styles.builderSummary}>
        <div>
          <span className={styles.summaryLabel}>Your starting brief</span>
          <dl>
            {questions.map((question) => (
              <div key={question.key}>
                <dt>{question.legend}</dt>
                <dd>{brief[question.key] || "Not specified yet"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <a className={styles.emailDraft} href={mailto}>
          Open email draft <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  );
}
