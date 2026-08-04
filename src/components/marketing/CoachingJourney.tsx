import SectionSignalRail from "@/components/effects/SectionSignalRail";
import styles from "./CoachingJourney.module.css";

type CoachingStage = {
  code: string;
  label: string;
  description: string;
  outcome: string;
  deliverable: string;
};

const tones = ["cognitive", "cognitive", "personality", "response"] as const;

export default function CoachingJourney({
  stages,
}: {
  stages: readonly CoachingStage[];
}) {
  const railItems = stages.map((stage, index) => ({
    id: `coaching-${stage.code}`,
    label: stage.label,
    tone: tones[index % tones.length],
  }));

  return (
    <section
      className={styles.journey}
      aria-labelledby="coaching-journey-heading"
    >
      <div className={styles.journeyHeader}>
        <h2 id="coaching-journey-heading">What each stage leaves behind</h2>
        <p>
          {String(stages.length).padStart(2, "0")} stages · one continuous
          practice
        </p>
      </div>

      <div className={styles.layout}>
        <SectionSignalRail items={railItems} />
        <div className={styles.chapters} data-reveal-group="assembly">
          {stages.map((stage, index) => (
            <article
              className={styles.chapter}
              data-reveal-item
              data-tone={tones[index % tones.length]}
              id={`coaching-${stage.code}`}
              key={stage.code}
            >
              <span className={styles.index}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.signal} aria-hidden />
              <div>
                <span className={styles.stageLabel}>{stage.label}</span>
                <h3>{stage.outcome}</h3>
                <p>{stage.deliverable}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
