"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/framework/FrameworkPage.module.css";
import ScrollMotion from "@/components/effects/ScrollMotion";
import CprTriangle from "@/components/marketing/CprTriangle";

type DimensionCode = "C" | "P" | "R";
type ArchetypeCode = DimensionCode | "CP" | "PR" | "CR" | "CPR";

const dimensions: {
  numeral: string;
  code: DimensionCode;
  title: string;
  subtitle: string;
  text: string;
}[] = [
  {
    numeral: "I",
    code: "C",
    title: "Cognitive",
    subtitle: "How you think",
    text: "How leaders process complexity, evaluate tradeoffs, and make strategic decisions under constraints.",
  },
  {
    numeral: "II",
    code: "P",
    title: "Personality",
    subtitle: "How you engage",
    text: "How leaders influence, build trust, and shape culture through presence, communication, and empathy.",
  },
  {
    numeral: "III",
    code: "R",
    title: "Response",
    subtitle: "How you adapt",
    text: "How leaders remain effective in stress, recover from setbacks, and adapt behavior in changing contexts.",
  },
];

const archetypes: {
  code: ArchetypeCode;
  label: string;
  description: string;
}[] = [
  {
    code: "C",
    label: "Strategic Thinker",
    description:
      "Pattern recognition under complexity. Decision discipline. The C-led leader brings analytical clarity to ambiguous problems.",
  },
  {
    code: "P",
    label: "Relational Leader",
    description:
      "Trust, presence, and communication. The P-led leader shapes culture through how they show up in the room.",
  },
  {
    code: "R",
    label: "Resilient Leader",
    description:
      "Calm under pressure, adaptive in chaos. The R-led leader holds the line when conditions shift around them.",
  },
  {
    code: "CP",
    label: "Visionary",
    description:
      "Strategy meets influence. Sees what is possible, then brings people along — combining analytical clarity with relational presence.",
  },
  {
    code: "PR",
    label: "Empathetic Strategist",
    description:
      "Reads people and pressure together. Leads with the team in view through stress, with empathy as the steadying force.",
  },
  {
    code: "CR",
    label: "Steady Navigator",
    description:
      "Analytical consistency married to adaptability. Reliable judgment in high-uncertainty operating environments.",
  },
  {
    code: "CPR",
    label: "Balanced Leader",
    description:
      "All three dimensions held in proportion. Rare — and worth working toward. The integrated profile most teams need at the top.",
  },
];

export default function FrameworkExperience() {
  const [activeDimension, setActiveDimension] = useState<DimensionCode>("C");
  const [activeArchetype, setActiveArchetype] = useState<ArchetypeCode>("CPR");
  const dimensionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const archetypeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedArchetype =
    archetypes.find((archetype) => archetype.code === activeArchetype) ?? archetypes[6];

  useEffect(() => {
    const staticExperience = window.matchMedia(
      "(prefers-reduced-motion: reduce), (max-width: 68rem), (max-height: 40rem)",
    );
    let observer: IntersectionObserver | undefined;

    const observeCards = () => {
      observer?.disconnect();
      observer = undefined;
      if (staticExperience.matches || typeof IntersectionObserver === "undefined") return;

      observer = new IntersectionObserver(
        (entries) => {
          if (archetypeRefs.current.includes(document.activeElement as HTMLButtonElement)) {
            return;
          }
          const activeEntry = entries.find((entry) => entry.isIntersecting);
          const code = activeEntry?.target.getAttribute("data-pattern-code") as
            | ArchetypeCode
            | null
            | undefined;
          if (code) {
            setActiveArchetype((current) => (current === code ? current : code));
          }
        },
        {
          rootMargin: "-34% 0px -50% 0px",
          threshold: 0,
        },
      );

      archetypeRefs.current.forEach((node) => {
        if (node) observer?.observe(node);
      });
    };

    observeCards();
    staticExperience.addEventListener("change", observeCards);

    return () => {
      observer?.disconnect();
      staticExperience.removeEventListener("change", observeCards);
    };
  }, []);

  function selectDimension(index: number) {
    const nextIndex = (index + dimensions.length) % dimensions.length;
    const next = dimensions[nextIndex];
    setActiveDimension(next.code);
    dimensionRefs.current[nextIndex]?.focus();
  }

  return (
    <>
      <section className={styles.explorer} aria-labelledby="dimension-explorer-title">
        <div className={styles.explorerHeading}>
          <p className={styles.sectionIndex}>02A / Explore the dimensions</p>
          <h2 id="dimension-explorer-title" className={`font-display ${styles.sectionTitle}`}>
            Read each signal in context.
          </h2>
          <p>
            Move between the dimensions to see the distinct question each one asks. Together,
            they describe a leader in motion rather than a personality in isolation.
          </p>
        </div>

        <div className={styles.explorerModule}>
          <div className={styles.tabList} role="tablist" aria-label="CPR dimensions">
            {dimensions.map((dimension, index) => (
              <button
                aria-controls={`dimension-panel-${dimension.code}`}
                aria-selected={activeDimension === dimension.code}
                className={styles.dimensionTab}
                data-dimension={dimension.code}
                id={`dimension-tab-${dimension.code}`}
                key={dimension.code}
                onClick={() => setActiveDimension(dimension.code)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    event.preventDefault();
                    selectDimension(index + 1);
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    event.preventDefault();
                    selectDimension(index - 1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    selectDimension(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    selectDimension(dimensions.length - 1);
                  }
                }}
                ref={(node) => {
                  dimensionRefs.current[index] = node;
                }}
                role="tab"
                tabIndex={activeDimension === dimension.code ? 0 : -1}
                type="button"
              >
                <span>{dimension.numeral}</span>
                <strong className="font-display">{dimension.code}</strong>
                <small>{dimension.subtitle}</small>
              </button>
            ))}
          </div>

          <div className={styles.dimensionStage} data-active={activeDimension}>
            <div className={styles.dimensionGeometry} aria-hidden="true">
              <svg className={styles.dimensionLinks} viewBox="0 0 100 100">
                <path className={styles.dimensionOutline} d="M50 24 L25 74 L75 74 Z" />
                <path
                  className={styles.dimensionSpoke}
                  data-signal="C"
                  d="M50 24 L50 54"
                  pathLength="1"
                />
                <path
                  className={styles.dimensionSpoke}
                  data-signal="P"
                  d="M25 74 L50 54"
                  pathLength="1"
                />
                <path
                  className={styles.dimensionSpoke}
                  data-signal="R"
                  d="M75 74 L50 54"
                  pathLength="1"
                />
              </svg>
              <span className={styles.geometryC}>C</span>
              <span className={styles.geometryP}>P</span>
              <span className={styles.geometryR}>R</span>
              <span className={styles.geometryCenter} />
            </div>

            <div className={styles.dimensionPanels}>
              {dimensions.map((dimension) => (
                <div
                  aria-labelledby={`dimension-tab-${dimension.code}`}
                  className={styles.dimensionPanel}
                  hidden={activeDimension !== dimension.code}
                  id={`dimension-panel-${dimension.code}`}
                  key={dimension.code}
                  role="tabpanel"
                  tabIndex={0}
                >
                  <p>{dimension.numeral} / {dimension.code}</p>
                  <h3 className="font-display">{dimension.title}</h3>
                  <span>{dimension.subtitle}</span>
                  <p>{dimension.text}</p>
                </div>
              ))}
            </div>
          </div>

          <ol className={styles.noScriptDimensions} aria-label="CPR dimensions">
            {dimensions.map((dimension) => (
              <li key={dimension.code}>
                <article>
                  <p>
                    {dimension.numeral} / {dimension.code}
                  </p>
                  <h3 className="font-display">{dimension.title}</h3>
                  <span>{dimension.subtitle}</span>
                  <p>{dimension.text}</p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.atlas} aria-labelledby="pattern-atlas-title">
        <div className={styles.atlasHeading}>
          <div>
            <p className={styles.sectionIndex}>03 / Seven recognisable patterns</p>
            <h2 id="pattern-atlas-title" className={`font-display ${styles.sectionTitle}`}>
              The pattern atlas.
            </h2>
          </div>
          <p>
            Every combination carries gifts and growth edges. Move through the seven
            relationships and the map resolves with you; every description remains visible.
          </p>
        </div>

        <ScrollMotion className={styles.atlasMotion}>
          <div className={styles.atlasLayout}>
            <aside className={styles.patternFocus} aria-label="CPR relationship map">
              <div className={styles.mapHeading}>
                <p>Relationship map / {selectedArchetype.code}</p>
                <span className={styles.scrollPrompt}>Scroll or choose</span>
                <span className={styles.choosePrompt}>Choose a pattern</span>
                <span className={styles.staticPrompt}>Seven patterns</span>
              </div>
              <CprTriangle
                activeCode={activeArchetype}
                appearance="cream"
                className={styles.atlasTriangle}
                interactive={false}
                layout="diagram"
                regions={archetypes}
              />
              <div className={styles.focusCopy}>
                <div className={styles.focusResolution} key={selectedArchetype.code}>
                  <h3 className="font-display">{selectedArchetype.label}</h3>
                  <p>{selectedArchetype.description}</p>
                </div>
                <span>Pattern, not verdict.</span>
              </div>
            </aside>

            <ol className={styles.patternGrid} aria-label="CPR leadership patterns">
              {archetypes.map((archetype, index) => (
                <li key={archetype.code}>
                  <button
                    aria-pressed={activeArchetype === archetype.code}
                    className={styles.patternCard}
                    data-pattern-code={archetype.code}
                    onClick={() => setActiveArchetype(archetype.code)}
                    onFocus={() => setActiveArchetype(archetype.code)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") {
                        setActiveArchetype(archetype.code);
                      }
                    }}
                    ref={(node) => {
                      archetypeRefs.current[index] = node;
                    }}
                    type="button"
                  >
                    <span className={styles.patternIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={`font-display ${styles.patternCode}`}>
                      {archetype.code}
                    </span>
                    <span className={styles.patternName}>{archetype.label}</span>
                    <span className={styles.patternDescription}>{archetype.description}</span>
                    <span className={styles.patternPrompt} aria-hidden>
                      Bring into focus ↗
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <ol className={styles.noScriptPatterns} aria-label="CPR leadership patterns">
              {archetypes.map((archetype, index) => (
                <li key={archetype.code}>
                  <article className={`${styles.patternCard} ${styles.staticPatternCard}`}>
                    <span className={styles.patternIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={`font-display ${styles.patternCode}`}>
                      {archetype.code}
                    </span>
                    <span className={styles.patternName}>{archetype.label}</span>
                    <span className={styles.patternDescription}>{archetype.description}</span>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </ScrollMotion>
      </section>
    </>
  );
}
