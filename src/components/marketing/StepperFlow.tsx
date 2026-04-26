"use client";

import { useState } from "react";
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
  const stage = stages[active];
  const n = stages.length;
  const progress = n > 1 ? active / (n - 1) : 0;

  const rowStyle = {
    ["--n" as never]: n,
    ["--progress" as never]: progress,
  } as CSSProperties;

  return (
    <div className="reveal-on-scroll stepper-flow">
      {/* DESKTOP — horizontal */}
      <div className="hidden md:block">
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
        <div className="mx-auto mt-12 max-w-2xl text-center md:mt-14">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#101114]/55">
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
      <ol className="md:hidden">
        {stages.map((s, i) => {
          const isActive = i === active;
          return (
            <li
              key={s.code}
              className="stepper-vrow"
              data-active={isActive ? "true" : "false"}
            >
              <button
                type="button"
                className="stepper-vbutton"
                onClick={() => setActive(i)}
                aria-pressed={isActive}
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
                className="stepper-vpanel"
                aria-hidden={!isActive}
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
    </div>
  );
}
