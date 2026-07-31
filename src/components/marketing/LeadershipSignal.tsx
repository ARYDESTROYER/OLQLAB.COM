import ScrollMotion from "@/components/effects/ScrollMotion";
import styles from "./LeadershipSignal.module.css";

const signals = [
  {
    index: "01",
    code: "C",
    title: "Cognitive",
    prompt: "How you think",
    action: "Discern the signal",
    tone: "cognitive",
    depth: "far",
  },
  {
    index: "02",
    code: "P",
    title: "Personality",
    prompt: "How you engage",
    action: "Read the room",
    tone: "personality",
    depth: "mid",
  },
  {
    index: "03",
    code: "R",
    title: "Response",
    prompt: "How you adapt",
    action: "Choose the response",
    tone: "response",
    depth: "near",
  },
] as const;

const mosaicCells = [
  { kind: "anchor", signal: 0 },
  { kind: "orbit", tone: "tealSoft", depth: "far" },
  { kind: "point", tone: "paper", depth: "mid" },
  { kind: "orbit", tone: "goldSoft", depth: "near" },
  { kind: "point", tone: "paper", depth: "far" },
  { kind: "anchor", signal: 1 },
  { kind: "point", tone: "goldSoft", depth: "mid" },
  { kind: "orbit", tone: "brass", depth: "far" },
  { kind: "point", tone: "paper", depth: "near" },
  { kind: "orbit", tone: "rustSoft", depth: "mid" },
  { kind: "anchor", signal: 2 },
  { kind: "point", tone: "goldSoft", depth: "near" },
] as const;

export default function LeadershipSignal() {
  return (
    <ScrollMotion className={styles.motion}>
      <figure className={styles.signal} aria-labelledby="leadership-signal-caption">
        <figcaption className={styles.header} id="leadership-signal-caption">
          <span>Leadership signal / CPR</span>
          <span>Observe · Interpret · Practise</span>
        </figcaption>

        <div className={styles.mosaic} aria-hidden="true">
          {mosaicCells.map((cell, index) => {
            if (cell.kind === "anchor") {
              const signal = signals[cell.signal];
              return (
                <div
                  className={`${styles.mosaicCell} ${styles.mosaicAnchor} ${styles[signal.tone]}`}
                  key={signal.code}
                >
                  <span className={styles.mosaicTitle}>{signal.title}</span>
                  <span className={`font-display ${styles.mosaicCode}`}>{signal.code}</span>
                  <span className={styles.mosaicPrompt}>{signal.prompt}</span>
                </div>
              );
            }

            return (
              <div
                className={`${styles.mosaicCell} ${styles[cell.tone]} ${
                  cell.kind === "orbit" ? styles.orbitCell : styles.pointCell
                }`}
                key={`${cell.kind}-${index}`}
              >
                {cell.kind === "orbit" ? (
                  <span className={styles.mosaicOrbit} data-scroll-layer={cell.depth}>
                    <span />
                  </span>
                ) : (
                  <span className={styles.mosaicPoint} data-scroll-layer={cell.depth} />
                )}
              </div>
            );
          })}
          <span className={styles.trace} />
        </div>

        <ol className={styles.modules}>
          {signals.map((signal) => (
            <li className={`${styles.module} ${styles[signal.tone]}`} key={signal.code}>
              <span className={styles.index}>{signal.index}</span>
              <span className={`font-display ${styles.code}`} aria-hidden>
                {signal.code}
              </span>
              <div className={styles.moduleCopy}>
                <h2>{signal.title}</h2>
                <p>{signal.prompt}</p>
                <span>{signal.action}</span>
              </div>
              <span className={styles.mobileOrbit} aria-hidden data-scroll-layer={signal.depth}>
                <span />
              </span>
            </li>
          ))}
        </ol>

        <p className="sr-only">
          The CPR framework observes three connected leadership signals: Cognitive, how
          you think; Personality, how you engage; and Response, how you adapt.
        </p>

        <div className={styles.progressTrack} aria-hidden>
          <span />
        </div>
      </figure>
    </ScrollMotion>
  );
}
