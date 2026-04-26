"use client";

import { useState } from "react";

type Region = {
  code: "C" | "P" | "R" | "CP" | "PR" | "CR" | "CPR";
  label: string;
  description: string;
};

/** Geometric coordinates inside a 0–100 viewBox.
 *  C is the top vertex, P is bottom-left, R is bottom-right.
 *  Edge midpoints sit on the triangle's edges; CPR sits at the centroid. */
const POSITIONS: Record<
  Region["code"],
  { x: number; y: number; size: number; labelX?: number; labelY?: number }
> = {
  C:   { x: 50,   y: 18,   size: 8.5,  labelX: 50,   labelY: 5 },
  P:   { x: 15,   y: 78,   size: 8.5,  labelX: 8,    labelY: 92 },
  R:   { x: 85,   y: 78,   size: 8.5,  labelX: 92,   labelY: 92 },
  CP:  { x: 32.5, y: 48,   size: 6.6 },
  CR:  { x: 67.5, y: 48,   size: 6.6 },
  PR:  { x: 50,   y: 78,   size: 6.6 },
  CPR: { x: 50,   y: 58,   size: 7.6 },
};

export default function CprTriangle({
  regions,
  defaultActive = "CPR",
  hint = "Hover or tap any region.",
}: {
  regions: Region[];
  defaultActive?: Region["code"];
  hint?: string;
}) {
  const [active, setActive] = useState<Region["code"]>(defaultActive);
  const current = regions.find((r) => r.code === active) ?? regions[0];

  // Vertex words (used to label the three primary nodes outside the SVG)
  const vertexLabel = (code: Region["code"]) =>
    regions.find((r) => r.code === code)?.label ?? "";

  return (
    <div className="reveal-on-scroll grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-20">
      {/* TRIANGLE */}
      <div className="relative mx-auto w-full max-w-[460px]">
        <svg
          viewBox="0 0 100 100"
          className="triangle-svg block w-full"
          role="presentation"
        >
          {/* Triangle perimeter */}
          <path
            className="triangle-edge"
            d="M 50 18 L 15 78 L 85 78 Z"
            fill="none"
            stroke="rgba(16,17,20,0.28)"
            strokeWidth="0.45"
            strokeLinejoin="round"
          />
          {/* Three medians, meeting at the centroid (CPR) */}
          <line
            className="triangle-median"
            x1="50" y1="18" x2="50" y2="78"
            stroke="rgba(16,17,20,0.12)"
            strokeWidth="0.28"
          />
          <line
            className="triangle-median"
            x1="15" y1="78" x2="67.5" y2="48"
            stroke="rgba(16,17,20,0.12)"
            strokeWidth="0.28"
          />
          <line
            className="triangle-median"
            x1="85" y1="78" x2="32.5" y2="48"
            stroke="rgba(16,17,20,0.12)"
            strokeWidth="0.28"
          />

          {/* Subtle highlight ring around the active node */}
          {(() => {
            const p = POSITIONS[active];
            return (
              <circle
                cx={p.x}
                cy={p.y}
                r={p.size + 3}
                fill="none"
                stroke="#A6824A"
                strokeWidth="0.35"
                opacity={0.7}
                style={{
                  transition:
                    "cx 450ms cubic-bezier(0.2,0.7,0.1,1), cy 450ms cubic-bezier(0.2,0.7,0.1,1), r 450ms cubic-bezier(0.2,0.7,0.1,1)",
                }}
              />
            );
          })()}

          {/* Nodes */}
          {regions.map((r, i) => {
            const p = POSITIONS[r.code];
            const isActive = r.code === active;
            return (
              <g
                key={r.code}
                className="triangle-node"
                style={{
                  transitionDelay: `${0.5 + i * 0.08}s`,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setActive(r.code)}
                onClick={() => setActive(r.code)}
                onFocus={() => setActive(r.code)}
                onTouchStart={() => setActive(r.code)}
                tabIndex={0}
                role="button"
                aria-label={`${r.code}: ${r.label}`}
              >
                {/* Invisible larger hit target */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.size + 5}
                  fill="transparent"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.size}
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
                  fontSize={
                    r.code.length === 3 ? "3.6" : r.code.length === 2 ? "4.2" : "5.6"
                  }
                  fill={isActive ? "#EFE8DA" : "#101114"}
                  style={{
                    fontFamily: "var(--font-instrument-serif), serif",
                    letterSpacing: "-0.04em",
                    pointerEvents: "none",
                    transition: "fill 360ms cubic-bezier(0.2,0.7,0.1,1)",
                  }}
                >
                  {r.code}
                </text>
              </g>
            );
          })}

          {/* Vertex word labels (rendered as SVG text so they scale with the diagram) */}
          <text
            x={POSITIONS.C.labelX}
            y={POSITIONS.C.labelY}
            textAnchor="middle"
            fontSize="2.8"
            fill="rgba(16,17,20,0.55)"
            style={{
              fontFamily: "var(--font-plus-jakarta), sans-serif",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {vertexLabel("C")}
          </text>
          <text
            x={POSITIONS.P.labelX}
            y={POSITIONS.P.labelY}
            textAnchor="start"
            fontSize="2.8"
            fill="rgba(16,17,20,0.55)"
            style={{
              fontFamily: "var(--font-plus-jakarta), sans-serif",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {vertexLabel("P")}
          </text>
          <text
            x={POSITIONS.R.labelX}
            y={POSITIONS.R.labelY}
            textAnchor="end"
            fontSize="2.8"
            fill="rgba(16,17,20,0.55)"
            style={{
              fontFamily: "var(--font-plus-jakarta), sans-serif",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {vertexLabel("R")}
          </text>
        </svg>
      </div>

      {/* DETAIL PANEL */}
      <div className="md:py-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#101114]/55">
          <span className="brass-dot" aria-hidden />
          {current.code}
        </p>
        <h3
          key={`label-${current.code}`}
          className="font-display animate-region-fade mt-6 text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-tight"
        >
          {current.label}
          <span className="brass-period">.</span>
        </h3>
        <p
          key={`desc-${current.code}`}
          className="animate-region-fade mt-6 text-base leading-relaxed text-[#101114]/76 md:text-lg"
        >
          {current.description}
        </p>

        {/* Region pills (small, all 7) — secondary navigation */}
        <div className="mt-10 flex flex-wrap gap-2">
          {regions.map((r) => {
            const isActive = r.code === active;
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => setActive(r.code)}
                onMouseEnter={() => setActive(r.code)}
                className={`font-display text-sm tracking-tight transition-colors duration-300 ${
                  isActive
                    ? "bg-[#101114] text-[#EFE8DA]"
                    : "bg-transparent text-[#101114]/65 hover:text-[#101114]"
                } border border-[#101114]/20 px-3 py-1.5`}
                aria-pressed={isActive}
              >
                {r.code}
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
