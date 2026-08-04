"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import ScrollMotion from "@/components/effects/ScrollMotion";
import styles from "./blindspot.module.css";

type Signal = {
  label: string;
  detail: string;
  x: number;
  y: number;
};

const signals: readonly Signal[] = [
  {
    label: "Unspoken friction",
    detail: "The tension the room has learned to work around.",
    x: 22,
    y: 27,
  },
  {
    label: "Decision defaults",
    detail: "The habit that becomes more visible when pressure rises.",
    x: 75,
    y: 23,
  },
  {
    label: "Quiet dissent",
    detail: "The challenge that never quite reaches the conversation.",
    x: 31,
    y: 72,
  },
  {
    label: "Intent / impact",
    detail: "The distance between what was meant and what was experienced.",
    x: 78,
    y: 69,
  },
] as const;

type FieldStyle = CSSProperties & {
  "--spot-x": string;
  "--spot-y": string;
};

export function BlindspotField() {
  const frameRef = useRef<HTMLDivElement>(null);
  const pointerFrameRef = useRef(0);
  const pointerPointRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );
  const staticExperienceRef = useRef(false);
  const [activeSignal, setActiveSignal] = useState<number | null>(null);

  useEffect(() => {
    const staticExperience = window.matchMedia(
      "(prefers-reduced-motion: reduce), (hover: none), (pointer: coarse), (max-width: 71.99rem), (max-height: 43.99rem), (forced-colors: active)",
    );
    const syncExperience = () => {
      staticExperienceRef.current = staticExperience.matches;
      if (staticExperience.matches && pointerFrameRef.current) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = 0;
        pointerPointRef.current = null;
      }
    };
    syncExperience();
    staticExperience.addEventListener("change", syncExperience);

    return () => {
      if (pointerFrameRef.current) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = 0;
      }
      pointerPointRef.current = null;
      staticExperience.removeEventListener("change", syncExperience);
    };
  }, []);

  const scheduleSpotlight = (clientX: number, clientY: number) => {
    if (staticExperienceRef.current) return;
    pointerPointRef.current = { clientX, clientY };
    if (pointerFrameRef.current) return;

    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = 0;
      const point = pointerPointRef.current;
      pointerPointRef.current = null;
      const frame = frameRef.current;
      if (!point || !frame || staticExperienceRef.current) return;

      const rect = frame.getBoundingClientRect();
      const x = Math.min(
        100,
        Math.max(0, ((point.clientX - rect.left) / rect.width) * 100),
      );
      const y = Math.min(
        100,
        Math.max(0, ((point.clientY - rect.top) / rect.height) * 100),
      );
      frame.style.setProperty("--spot-x", `${x.toFixed(2)}%`);
      frame.style.setProperty("--spot-y", `${y.toFixed(2)}%`);
    });
  };

  const selectSignal = (index: number) => {
    const signal = signals[index];
    const frame = frameRef.current;
    if (!signal || !frame) return;
    frame.style.setProperty("--spot-x", `${signal.x}%`);
    frame.style.setProperty("--spot-y", `${signal.y}%`);
    setActiveSignal(index);
  };

  const initialStyle: FieldStyle = {
    "--spot-x": "22%",
    "--spot-y": "27%",
  };

  return (
    <ScrollMotion
      className={styles.fieldMotion}
      progressMode="sticky"
      stickyOffset={72}
    >
      <section
        id="perception-field"
        className={styles.field}
        style={initialStyle}
        aria-labelledby="field-title"
      >
        <div className={styles.fieldStage}>
          <div className={styles.fieldHeader}>
            <div>
              <span>02 / PERCEPTION FIELD</span>
              <h2 id="field-title">Move to notice. Scroll to understand.</h2>
            </div>
            <p>
              The aperture widens as you continue. The content never depends on
              the effect.
            </p>
          </div>

          <div
            ref={frameRef}
            className={styles.fieldFrame}
            data-active-signal={activeSignal ?? undefined}
            onPointerMove={(event) => {
              if (event.pointerType === "mouse" || event.pointerType === "pen") {
                scheduleSpotlight(event.clientX, event.clientY);
              }
            }}
            onPointerDown={(event) =>
              scheduleSpotlight(event.clientX, event.clientY)
            }
          >
            <div className={styles.fieldPrompt} aria-hidden>
              <span>What is visible</span>
              <strong>is not the whole system.</strong>
            </div>

            <span className={styles.fieldSweep} aria-hidden />

            <div className={styles.latentField} aria-hidden>
              <svg
                className={styles.signalLines}
                viewBox="0 0 1000 620"
                preserveAspectRatio="none"
              >
                <path
                  data-from="0"
                  data-to="1"
                  d="M220 167 L500 310 L750 143"
                />
                <path
                  data-from="0"
                  data-to="2"
                  d="M220 167 L310 446 L500 310"
                />
                <path
                  data-from="1"
                  data-to="3"
                  d="M500 310 L780 428 L750 143"
                />
                <path data-from="2" data-to="3" d="M310 446 L780 428" />
              </svg>
              {signals.map((signal, index) => (
                <div
                  key={signal.label}
                  className={styles.latentSignal}
                  style={{ left: `${signal.x}%`, top: `${signal.y}%` }}
                  data-active={activeSignal === index ? "true" : "false"}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{signal.label}</strong>
                  <p>{signal.detail}</p>
                </div>
              ))}
              <p className={styles.fieldResolution}>
                Clarity appears when the signals are seen together.
              </p>
            </div>

            <div
              className={styles.signalControls}
              aria-label="Signals in the perception field"
            >
              {signals.map((signal, index) => (
                <button
                  key={signal.label}
                  type="button"
                  className={styles.signalControl}
                  style={{ left: `${signal.x}%`, top: `${signal.y}%` }}
                  aria-label={`Reveal ${signal.label}: ${signal.detail}`}
                  aria-pressed={activeSignal === index}
                  onFocus={() => selectSignal(index)}
                  onClick={() => selectSignal(index)}
                >
                  <span aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </div>

            <div className={styles.fieldMeter} aria-hidden>
              <span>Limited view</span>
              <i />
              <span>Whole pattern</span>
            </div>
          </div>
        </div>

        <noscript>
          <ul className={styles.noScriptSignals}>
            {signals.map((signal) => (
              <li key={signal.label}>
                <strong>{signal.label}</strong>
                <span>{signal.detail}</span>
              </li>
            ))}
          </ul>
        </noscript>
      </section>
    </ScrollMotion>
  );
}
