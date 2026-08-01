"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  "--field-progress": string;
  "--aperture": string;
  "--sweep-x": string;
};

export function BlindspotField() {
  const fieldRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointerFrameRef = useRef(0);
  const pointerPointRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );
  const staticExperienceRef = useRef(false);
  const [activeSignal, setActiveSignal] = useState<number | null>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const staticExperience = window.matchMedia(
      "(prefers-reduced-motion: reduce), (hover: none), (pointer: coarse)",
    );
    staticExperienceRef.current = staticExperience.matches;
    let frame = 0;
    let active = false;

    const update = () => {
      frame = 0;
      if (staticExperience.matches) {
        field.style.setProperty("--field-progress", "1");
        field.style.setProperty("--sweep-x", "120vw");
        return;
      }

      const rect = field.getBoundingClientRect();
      const viewport = window.innerHeight;
      const stickyTop = 72;
      const travel = Math.max(1, rect.height - viewport + stickyTop);
      const raw = (stickyTop - rect.top) / travel;
      const progress = Math.min(1, Math.max(0, raw));
      const aperture =
        128 +
        Math.max(rect.width, rect.height) * 1.35 * progress * progress;
      field.style.setProperty("--field-progress", progress.toFixed(4));
      field.style.setProperty("--aperture", `${aperture.toFixed(1)}px`);
      const sweep = rect.width * (-0.18 + progress * 1.36);
      field.style.setProperty("--sweep-x", `${sweep.toFixed(1)}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const onMotionChange = () => {
      staticExperienceRef.current = staticExperience.matches;
      if (staticExperience.matches) {
        field.removeAttribute("data-field-enhanced");
      } else if (typeof IntersectionObserver !== "undefined") {
        field.dataset.fieldEnhanced = "true";
      }
      if (staticExperience.matches && pointerFrameRef.current) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = 0;
        pointerPointRef.current = null;
      }
      if (active && staticExperience.matches) {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
      } else if (active) {
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule, { passive: true });
      }
      schedule();
    };
    let observer: IntersectionObserver | undefined;

    if (staticExperience.matches) update();
    if (typeof IntersectionObserver === "undefined") {
      field.dataset.fieldStatic = "true";
      field.style.setProperty("--field-progress", "1");
      field.style.setProperty("--aperture", "120vmax");
    } else {
      if (!staticExperience.matches) field.dataset.fieldEnhanced = "true";
      observer = new IntersectionObserver(
        ([entry]) => {
          const nextActive = Boolean(entry?.isIntersecting);
          if (nextActive === active) return;
          active = nextActive;
          if (active && !staticExperience.matches) {
            field.dataset.fieldActive = "true";
            window.addEventListener("scroll", schedule, { passive: true });
            window.addEventListener("resize", schedule, { passive: true });
            schedule();
          } else if (active) {
            field.dataset.fieldActive = "true";
            update();
          } else {
            field.removeAttribute("data-field-active");
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
          }
        },
        { rootMargin: "20% 0px" },
      );
      observer.observe(field);
    }
    staticExperience.addEventListener("change", onMotionChange);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (pointerFrameRef.current) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = 0;
      }
      pointerPointRef.current = null;
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      staticExperience.removeEventListener("change", onMotionChange);
      field.removeAttribute("data-field-enhanced");
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
    "--field-progress": "0",
    "--aperture": "8rem",
    "--sweep-x": "-12rem",
  };

  return (
    <section
      id="perception-field"
      ref={fieldRef}
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
              <path data-from="0" data-to="1" d="M220 167 L500 310 L750 143" />
              <path data-from="0" data-to="2" d="M220 167 L310 446 L500 310" />
              <path data-from="1" data-to="3" d="M500 310 L780 428 L750 143" />
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
                <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
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
  );
}
