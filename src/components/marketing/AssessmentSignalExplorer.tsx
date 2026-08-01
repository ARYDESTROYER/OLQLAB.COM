"use client";

import { useState } from "react";
import ScrollMotion from "@/components/effects/ScrollMotion";
import CprTriangle, {
  type CprCode,
  type CprRegion,
} from "@/components/marketing/CprTriangle";
import styles from "./AssessmentSignalExplorer.module.css";

const DIMENSIONS = [
  { code: "C", label: "Cognitive", verb: "Think" },
  { code: "P", label: "Personality", verb: "Engage" },
  { code: "R", label: "Response", verb: "Adapt" },
] as const;

type AssessmentSignalExplorerProps = {
  regions: readonly CprRegion[];
};

export default function AssessmentSignalExplorer({
  regions,
}: AssessmentSignalExplorerProps) {
  const [activeCode, setActiveCode] = useState<CprCode>("CPR");
  const activeIndex = Math.max(
    0,
    regions.findIndex((region) => region.code === activeCode),
  );
  const active = regions[activeIndex] ?? regions[0];

  if (!active) return null;

  return (
    <ScrollMotion className={styles.scene}>
      <div className={styles.pin}>
        <div className={styles.frame} data-code={activeCode}>
          <div className={styles.expansionPlane} aria-hidden="true">
            <span
              className={styles.washC}
              data-active={activeCode.includes("C")}
            />
            <span
              className={styles.washP}
              data-active={activeCode.includes("P")}
            />
            <span
              className={styles.washR}
              data-active={activeCode.includes("R")}
            />
          </div>

          <span
            aria-hidden="true"
            className={`${styles.orbMotion} ${styles.orbCMotion}`}
            data-scroll-layer="far"
          >
            <span
              className={styles.orbC}
              data-active={activeCode.includes("C")}
            />
          </span>
          <span
            aria-hidden="true"
            className={`${styles.orbMotion} ${styles.orbPMotion}`}
            data-scroll-layer="mid"
          >
            <span
              className={styles.orbP}
              data-active={activeCode.includes("P")}
            />
          </span>
          <span
            aria-hidden="true"
            className={`${styles.orbMotion} ${styles.orbRMotion}`}
            data-scroll-layer="near"
          >
            <span
              className={styles.orbR}
              data-active={activeCode.includes("R")}
            />
          </span>

          <div className={styles.stageContent}>
            <header className={styles.stageHeader}>
              <div className={styles.stageMeta}>
                <span>Leadership signal / CPR</span>
                <span>
                  Track {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(regions.length).padStart(2, "0")}
                </span>
              </div>

              <ol className={styles.dimensionRail} aria-label="CPR dimensions">
                {DIMENSIONS.map((dimension) => (
                  <li
                    data-active={activeCode.includes(dimension.code)}
                    data-dimension={dimension.code}
                    key={dimension.code}
                  >
                    <strong>{dimension.code}</strong>
                    <span>{dimension.label}</span>
                    <small>{dimension.verb}</small>
                  </li>
                ))}
              </ol>
            </header>

            <div className={styles.workspace}>
              <div className={styles.mapPanel}>
                <div className={styles.mapHeading}>
                  <span>Signal field</span>
                  <span>12 relationships · 7 tracks</span>
                </div>
                <CprTriangle
                  activeCode={activeCode}
                  className={`${styles.map} is-revealed`}
                  defaultActive="CPR"
                  hint="Select a region of the triangle. Arrow keys move between regions."
                  layout="diagram"
                  onActiveChange={setActiveCode}
                  regions={regions}
                />
                <p className={styles.mapHint}>
                  Select a region · Use arrow keys to move between tracks
                </p>
              </div>

              <aside
                className={styles.detail}
                aria-live="polite"
                aria-atomic="true"
              >
                <p className={styles.detailCode}>
                  <span aria-hidden="true" />
                  In focus / {active.code}
                </p>
                <div className={styles.detailResolution} key={active.code}>
                  <h3 className="font-display">
                    {active.label}
                    <span aria-hidden="true">.</span>
                  </h3>
                  <p>{active.description}</p>
                </div>
                <dl className={styles.readout}>
                  <div>
                    <dt>Coverage</dt>
                    <dd>
                      {activeCode.length === 3
                        ? "Integrated"
                        : activeCode.length === 2
                          ? "Paired"
                          : "Focused"}
                    </dd>
                  </div>
                  <div>
                    <dt>Signal</dt>
                    <dd>{activeCode.split("").join(" · ")}</dd>
                  </div>
                </dl>
              </aside>
            </div>

            <noscript>
              <dl className={styles.noScriptCatalogue}>
                {regions.map((region) => (
                  <div key={region.code}>
                    <dt>
                      <span>{region.code}</span>
                      {region.label}
                    </dt>
                    <dd>{region.description}</dd>
                  </div>
                ))}
              </dl>
            </noscript>
          </div>
        </div>
      </div>
    </ScrollMotion>
  );
}
