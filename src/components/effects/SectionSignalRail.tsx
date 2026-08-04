"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./SectionSignalRail.module.css";

export type SectionSignalItem = {
  id: string;
  label: string;
  tone?: "cognitive" | "personality" | "response" | "ink";
};

export default function SectionSignalRail({
  items,
}: {
  items: readonly SectionSignalItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const tones = {
    cognitive: "var(--signal-cognitive-vivid)",
    personality: "var(--signal-personality-vivid)",
    response: "var(--signal-response-vivid)",
    ink: "var(--ink)",
  } as const;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const targets = items
      .map((item, index) => {
        const element = document.getElementById(item.id);
        return element ? { element, index } : null;
      })
      .filter(
        (item): item is { element: HTMLElement; index: number } =>
          item !== null,
      );

    if (targets.length === 0) return;

    const rail = railRef.current;
    if (rail) rail.dataset.observerReady = "true";

    const indexes = new Map<Element, number>(
      targets.map(({ element, index }) => [element, index]),
    );
    const visible = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = indexes.get(entry.target);
          if (index === undefined) continue;
          if (entry.isIntersecting) visible.set(index, entry.intersectionRatio);
          else visible.delete(index);
        }

        if (visible.size > 0) {
          const next = [...visible.entries()].sort(
            ([indexA, ratioA], [indexB, ratioB]) =>
              ratioB - ratioA || indexA - indexB,
          )[0]?.[0];
          if (next !== undefined) setActiveIndex(next);
        }
      },
      {
        rootMargin: "-24% 0px -54% 0px",
        threshold: [0, 0.15, 0.35, 0.6],
      },
    );

    targets.forEach(({ element }) => observer.observe(element));
    return () => {
      observer.disconnect();
      rail?.removeAttribute("data-observer-ready");
    };
  }, [items]);

  return (
    <div
      className={styles.rail}
      aria-hidden="true"
      data-active-index={activeIndex}
      ref={railRef}
      style={
        {
          "--active-index": activeIndex,
          "--rail-count": Math.max(1, items.length),
          "--rail-tone": tones[items[activeIndex]?.tone ?? "ink"],
        } as CSSProperties
      }
    >
      <span className={styles.progress} />
      {items.map((item, index) => (
        <span
          className={styles.item}
          data-active={index === activeIndex ? "true" : "false"}
          data-tone={item.tone ?? "ink"}
          key={item.id}
        >
          <span className={styles.marker}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className={styles.label}>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
