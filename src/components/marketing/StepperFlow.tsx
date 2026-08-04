"use client";

import { useId, useState } from "react";
import type { CSSProperties } from "react";

type Stage = {
  code: string;
  label: string;
  description: string;
};

/**
 * Horizontal stepper (desktop) / vertical accordion-style stepper (mobile).
 *
 * Desktop:  numbered nodes in a horizontal row, connected by a hairline.
 *           The portion of the line before the active node fills with ink
 *           (a "you've been here" trail). A 36px vertical hairline drops
 *           from the active node down to the description panel and slides
 *           sideways when the active node changes.
 * Mobile:   the same data laid out vertically. Each row has a circle, a
 *           number, and a label; the active row expands to show its
 *           description below it.
 */
export default function StepperFlow({
  stages,
  defaultIndex = 0,
}: {
  stages: Stage[];
  defaultIndex?: number;
}) {
  const [active, setActive] = useState(defaultIndex);
  const instanceId = useId();
  const stage = stages[active];
  const n = stages.length;
  const progress = n > 1 ? active / (n - 1) : 0;
  const tones = [
    { accent: "var(--signal-cognitive, #173E45)", soft: "var(--signal-cognitive-soft, #B9CCC5)" },
    { accent: "var(--signal-cognitive, #173E45)", soft: "var(--signal-cognitive-soft, #B9CCC5)" },
    { accent: "var(--signal-personality, #D19A51)", soft: "var(--signal-personality-soft, #EFD49C)" },
    { accent: "var(--signal-response, #743B2D)", soft: "var(--signal-response-soft, #D7AA8F)" },
  ];
  const tone = tones[active % tones.length];

  const rowStyle = {
    ["--n" as never]: n,
    ["--progress" as never]: progress,
    ["--stepper-accent" as never]: tone.accent,
    ["--stepper-soft" as never]: tone.soft,
  } as CSSProperties;

  return (
    <div className="stepper-flow" style={rowStyle} data-tone={active} data-reveal-parts>
      {/* DESKTOP — horizontal */}
      <div className="stepper-desktop hidden md:block">
        <div className="stepper-row" style={rowStyle}>
          {/* Track (faded) — sits behind the circles */}
          <div className="stepper-track" aria-hidden>
            <div className="stepper-track-fill" />
          </div>
          {/* Drop-line below active node */}
          <div className="stepper-dropline" aria-hidden />

          {stages.map((s, i) => {
            const isActive = i === active;
            return (
              <button
                key={s.code}
                type="button"
                className="stepper-step"
                data-active={isActive ? "true" : "false"}
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
                aria-pressed={isActive}
                aria-controls={`${instanceId}-desktop-detail`}
                style={{ transitionDelay: `${0.55 + i * 0.07}s` }}
              >
                <span className="stepper-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="stepper-circle" aria-hidden />
                <span className="stepper-label">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Description panel */}
        <div
          id={`${instanceId}-desktop-detail`}
          className="mx-auto mt-12 max-w-2xl text-center md:mt-14"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#101114]/65">
            <span className="brass-dot" aria-hidden />
            Stage {String(active + 1).padStart(2, "0")}
          </p>
          <h3
            key={`label-${stage.code}`}
            className="font-display animate-region-fade mt-6 text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-tight"
          >
            {stage.label}
            <span className="brass-period">.</span>
          </h3>
          <p
            key={`desc-${stage.code}`}
            className="animate-region-fade mt-5 text-base leading-relaxed text-[#101114]/76 md:text-lg"
          >
            {stage.description}
          </p>
        </div>
      </div>

      {/* MOBILE — vertical */}
      <ol className="stepper-mobile md:hidden">
        {stages.map((s, i) => {
          const isActive = i === active;
          return (
            <li
              key={s.code}
              className="stepper-vrow"
              data-active={isActive ? "true" : "false"}
            >
              <button
                id={`${instanceId}-${s.code}-control`}
                type="button"
                className="stepper-vbutton"
                onClick={() => setActive(i)}
                aria-pressed={isActive}
                aria-expanded={isActive}
                aria-controls={`${instanceId}-${s.code}-panel`}
              >
                <span className="stepper-vcircle" aria-hidden />
                <span className="stepper-vmeta">
                  <span className="stepper-vnum">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="stepper-vlabel">{s.label}</span>
                </span>
              </button>

              <div
                id={`${instanceId}-${s.code}-panel`}
                className="stepper-vpanel"
                aria-hidden={!isActive}
                aria-labelledby={`${instanceId}-${s.code}-control`}
                role="region"
              >
                <div className="stepper-vpanel-inner">
                  <p className="text-base leading-relaxed text-[#101114]/76">
                    {s.description}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <noscript>
        <ol className="stepper-noscript" aria-label="Coaching stages">
          {stages.map((item, index) => (
            <li key={item.code}>
              <span>Stage {String(index + 1).padStart(2, "0")}</span>
              <h3>{item.label}</h3>
              <p>{item.description}</p>
            </li>
          ))}
        </ol>
      </noscript>
    </div>
  );
}
