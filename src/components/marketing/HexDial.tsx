"use client";

import { useState } from "react";

type Discipline = {
  code: string;
  label: string;
  description: string;
};

const HEX_RADIUS = 38;
const CENTER = { x: 50, y: 50 };

/** Compute the (x, y) for the i-th vertex of a regular n-gon centred at
 *  CENTER with radius HEX_RADIUS. Vertex 0 sits at the top (270°), then
 *  goes clockwise. */
function vertexPos(i: number, n: number) {
  const angle = (Math.PI / 180) * (270 + (360 / n) * i);
  return {
    x: CENTER.x + HEX_RADIUS * Math.cos(angle),
    y: CENTER.y + HEX_RADIUS * Math.sin(angle),
  };
}

export default function HexDial({
  disciplines,
  defaultIndex = 0,
  centerLabel = "Practice",
  hint = "Hover or tap any vertex.",
}: {
  disciplines: Discipline[];
  defaultIndex?: number;
  centerLabel?: string;
  hint?: string;
}) {
  const [activeIdx, setActiveIdx] = useState(defaultIndex);
  const active = disciplines[activeIdx];
  const n = disciplines.length;

  // Path connecting all vertices in order, closed.
  const hexPath =
    disciplines
      .map((_, i) => {
        const p = vertexPos(i, n);
        return `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      })
      .join(" ") + " Z";

  const activePos = vertexPos(activeIdx, n);

  return (
    <div className="reveal-on-scroll grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-20">
      {/* HEXAGON */}
      <div className="relative mx-auto w-full max-w-[460px]">
        <svg
          viewBox="0 0 100 100"
          className="hex-svg block w-full"
          role="presentation"
        >
          {/* Hexagon perimeter */}
          <path
            className="hex-edge"
            d={hexPath}
            fill="none"
            stroke="rgba(16,17,20,0.22)"
            strokeWidth="0.45"
            strokeLinejoin="round"
          />

          {/* Spokes from center to each vertex */}
          {disciplines.map((_, i) => {
            const p = vertexPos(i, n);
            const isActive = activeIdx === i;
            return (
              <line
                key={`spoke-${i}`}
                className="hex-spoke"
                x1={CENTER.x}
                y1={CENTER.y}
                x2={p.x}
                y2={p.y}
                stroke={isActive ? "#A6824A" : "rgba(16,17,20,0.12)"}
                strokeWidth={isActive ? "0.4" : "0.28"}
                style={{
                  transition:
                    "stroke 400ms cubic-bezier(0.2,0.7,0.1,1), stroke-width 400ms cubic-bezier(0.2,0.7,0.1,1)",
                }}
              />
            );
          })}

          {/* Active highlight ring */}
          <circle
            cx={activePos.x}
            cy={activePos.y}
            r="9.5"
            fill="none"
            stroke="#A6824A"
            strokeWidth="0.35"
            opacity="0.7"
            style={{
              transition:
                "cx 450ms cubic-bezier(0.2,0.7,0.1,1), cy 450ms cubic-bezier(0.2,0.7,0.1,1)",
            }}
          />

          {/* Center dot + label */}
          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r="0.9"
            fill="#A6824A"
            opacity="0.8"
          />
          <text
            x={CENTER.x}
            y={CENTER.y + 5}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="2.6"
            fill="rgba(16,17,20,0.55)"
            style={{
              fontFamily: "var(--font-plus-jakarta), sans-serif",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {centerLabel}
          </text>

          {/* Vertex nodes */}
          {disciplines.map((d, i) => {
            const p = vertexPos(i, n);
            const isActive = activeIdx === i;
            return (
              <g
                key={d.code}
                className="hex-node"
                style={{
                  transitionDelay: `${0.7 + i * 0.07}s`,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => setActiveIdx(i)}
                onFocus={() => setActiveIdx(i)}
                onTouchStart={() => setActiveIdx(i)}
                tabIndex={0}
                role="button"
                aria-label={d.label}
              >
                {/* Larger invisible hit target */}
                <circle cx={p.x} cy={p.y} r="11" fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="7"
                  fill={isActive ? "#101114" : "#EFE8DA"}
                  stroke="#101114"
                  strokeWidth={isActive ? "0.7" : "0.45"}
                  style={{
                    transition:
                      "fill 360ms cubic-bezier(0.2,0.7,0.1,1), stroke-width 360ms cubic-bezier(0.2,0.7,0.1,1)",
                  }}
                />
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="3.6"
                  fill={isActive ? "#EFE8DA" : "#101114"}
                  style={{
                    fontFamily: "var(--font-instrument-serif), serif",
                    letterSpacing: "-0.02em",
                    pointerEvents: "none",
                    transition: "fill 360ms cubic-bezier(0.2,0.7,0.1,1)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* DETAIL PANEL */}
      <div className="md:py-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#101114]/55">
          <span className="brass-dot" aria-hidden />
          {String(activeIdx + 1).padStart(2, "0")} · Discipline
        </p>
        <h3
          key={`label-${active.code}`}
          className="font-display animate-region-fade mt-6 text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-tight"
        >
          {active.label}
          <span className="brass-period">.</span>
        </h3>
        <p
          key={`desc-${active.code}`}
          className="animate-region-fade mt-6 text-base leading-relaxed text-[#101114]/76 md:text-lg"
        >
          {active.description}
        </p>

        {/* Numbered pill row */}
        <div className="mt-10 flex flex-wrap gap-2">
          {disciplines.map((d, i) => {
            const isActive = activeIdx === i;
            return (
              <button
                key={d.code}
                type="button"
                onClick={() => setActiveIdx(i)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`font-display text-sm tracking-tight transition-colors duration-300 ${
                  isActive
                    ? "bg-[#101114] text-[#EFE8DA]"
                    : "bg-transparent text-[#101114]/65 hover:text-[#101114]"
                } border border-[#101114]/20 px-3 py-1.5`}
                aria-pressed={isActive}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-[11px] uppercase tracking-[0.22em] text-[#101114]/45">
          {hint}
        </p>
      </div>
    </div>
  );
}
