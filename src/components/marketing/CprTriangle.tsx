"use client";

import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import styles from "./CprTriangle.module.css";

export type CprCode = "C" | "P" | "R" | "CP" | "PR" | "CR" | "CPR";

export type CprRegion = {
  code: CprCode;
  label: string;
  description: string;
};

type Position = {
  x: number;
  y: number;
  ringSize: number;
  kind: "vertex" | "pair" | "centre";
};

const POSITIONS: Record<CprCode, Position> = {
  C: { x: 50, y: 18, ringSize: 8.5, kind: "vertex" },
  P: { x: 15, y: 79, ringSize: 8.5, kind: "vertex" },
  R: { x: 85, y: 79, ringSize: 8.5, kind: "vertex" },
  CP: { x: 31.5, y: 46, ringSize: 7.8, kind: "pair" },
  CR: { x: 68.5, y: 46, ringSize: 7.8, kind: "pair" },
  PR: { x: 50, y: 79, ringSize: 7.8, kind: "pair" },
  CPR: { x: 50, y: 57.5, ringSize: 8.2, kind: "centre" },
};

type NodeStyle = CSSProperties & {
  "--node-x": string;
  "--node-y": string;
  "--node-order": number;
};

type CprTriangleProps = {
  regions: readonly CprRegion[];
  defaultActive?: CprCode;
  activeCode?: CprCode;
  onActiveChange?: (code: CprCode) => void;
  hint?: string;
  appearance?: "cream" | "brass" | "ink";
  layout?: "split" | "diagram";
  interactive?: boolean;
  vertexLabels?: { C: string; P: string; R: string };
  className?: string;
};

export default function CprTriangle({
  regions,
  defaultActive = "CPR",
  activeCode,
  onActiveChange,
  hint = "Choose a region to explore the relationship.",
  appearance = "cream",
  layout = "split",
  interactive = true,
  vertexLabels = {
    C: "Cognitive",
    P: "Personality",
    R: "Response",
  },
  className,
}: CprTriangleProps) {
  const [internalActive, setInternalActive] = useState<CprCode>(defaultActive);
  const detailId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedCode = activeCode ?? internalActive;
  const selected = regions.find((region) => region.code === selectedCode) ?? regions[0];
  const selectedPosition = POSITIONS[selected.code];

  function select(code: CprCode) {
    if (activeCode === undefined) setInternalActive(code);
    onActiveChange?.(code);
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") target = index + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") target = index - 1;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = regions.length - 1;
    if (target === undefined) return;

    event.preventDefault();
    const nextIndex = (target + regions.length) % regions.length;
    const next = regions[nextIndex];
    select(next.code);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className={`reveal-on-scroll ${styles.root} ${styles[appearance]} ${
        styles[layout]
      }${className ? ` ${className}` : ""}`}
    >
      <div className={styles.visualColumn}>
        <div className={styles.canvas}>
          <span className={styles.gridPlane} data-scroll-layer="far" aria-hidden />
          <svg
            aria-hidden="true"
            className={styles.geometry}
            focusable="false"
            viewBox="0 0 100 100"
          >
            <path className={styles.edge} d="M 50 18 L 15 79 L 85 79 Z" />
            <line className={styles.median} x1="50" y1="18" x2="50" y2="79" />
            <line className={styles.median} x1="15" y1="79" x2="68.5" y2="46" />
            <line className={styles.median} x1="85" y1="79" x2="31.5" y2="46" />
            <circle
              className={styles.activeRing}
              cx={selectedPosition.x}
              cy={selectedPosition.y}
              r={selectedPosition.ringSize + 3}
            />
          </svg>

          <span className={`${styles.vertexLabel} ${styles.labelC}`} aria-hidden>
            {vertexLabels.C}
          </span>
          <span className={`${styles.vertexLabel} ${styles.labelP}`} aria-hidden>
            {vertexLabels.P}
          </span>
          <span className={`${styles.vertexLabel} ${styles.labelR}`} aria-hidden>
            {vertexLabels.R}
          </span>

          <div
            className={styles.nodes}
            data-interactive={interactive ? "true" : "false"}
            role={interactive ? "group" : undefined}
            aria-label={interactive ? "CPR relationship regions" : undefined}
          >
            {regions.map((region, index) => {
              const position = POSITIONS[region.code];
              const isActive = selected.code === region.code;
              const nodeStyle: NodeStyle = {
                "--node-x": `${position.x}%`,
                "--node-y": `${position.y}%`,
                "--node-order": index,
              };
              const nodeClass = `${styles.node} ${styles[position.kind]}`;

              if (!interactive) {
                return (
                  <span
                    aria-hidden
                    className={nodeClass}
                    data-active={isActive ? "true" : "false"}
                    key={region.code}
                    style={nodeStyle}
                  >
                    {region.code}
                  </span>
                );
              }

              return (
                <button
                  aria-controls={layout === "split" ? detailId : undefined}
                  aria-label={`${region.code}: ${region.label}`}
                  aria-pressed={isActive}
                  className={nodeClass}
                  key={region.code}
                  onClick={() => select(region.code)}
                  onFocus={() => select(region.code)}
                  onKeyDown={(event) => moveFocus(event, index)}
                  ref={(node) => {
                    buttonRefs.current[index] = node;
                  }}
                  style={nodeStyle}
                  tabIndex={isActive ? 0 : -1}
                  type="button"
                >
                  {region.code}
                </button>
              );
            })}
          </div>

          {interactive ? (
            <div className={styles.staticNodes} aria-hidden="true">
              {regions.map((region, index) => {
                const position = POSITIONS[region.code];
                const nodeStyle: NodeStyle = {
                  "--node-x": `${position.x}%`,
                  "--node-y": `${position.y}%`,
                  "--node-order": index,
                };

                return (
                  <span
                    className={`${styles.node} ${styles[position.kind]}`}
                    data-active={selected.code === region.code ? "true" : "false"}
                    key={region.code}
                    style={nodeStyle}
                  >
                    {region.code}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {layout === "split" ? (
        <div className={styles.detail} id={detailId}>
          <p className={styles.detailCode}>
            <span aria-hidden />
            In focus / {selected.code}
          </p>
          <div aria-live="polite" aria-atomic="true">
            <h3 className="font-display" key={`label-${selected.code}`}>
              {selected.label}<span aria-hidden>.</span>
            </h3>
            <p key={`description-${selected.code}`}>{selected.description}</p>
          </div>
          <p className={styles.hint}>{hint}</p>
        </div>
      ) : null}

      {layout === "split" ? (
        <dl className={styles.noScriptCatalogue}>
          {regions.map((region) => (
            <div key={region.code}>
              <dt>
                {region.code} / {region.label}
              </dt>
              <dd>{region.description}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
