"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { calculateScrollMotion } from "@/lib/scroll-motion";
import styles from "./ScrollMotion.module.css";

type ScrollMotionProps = {
  children: ReactNode;
  className?: string;
};

function setLength(root: HTMLDivElement, property: string, value: number) {
  root.style.setProperty(property, `${value.toFixed(2)}px`);
}

export default function ScrollMotion({ children, className }: ScrollMotionProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let isNearViewport = true;

    const clearMotion = () => {
      root.removeAttribute("data-scroll-enhanced");
      root.removeAttribute("data-scroll-active");
      root.style.setProperty("--scroll-progress", "0");
      [
        "--scroll-far-x",
        "--scroll-far-y",
        "--scroll-mid-x",
        "--scroll-mid-y",
        "--scroll-near-x",
        "--scroll-near-y",
      ].forEach((property) => root.style.setProperty(property, "0px"));
      root.style.setProperty("--scroll-turn", "0deg");
    };

    const update = () => {
      frame = 0;
      if (motionPreference.matches) {
        clearMotion();
        return;
      }

      const rect = root.getBoundingClientRect();
      const values = calculateScrollMotion(rect.top, rect.height, window.innerHeight);
      root.dataset.scrollEnhanced = "true";
      root.style.setProperty("--scroll-progress", values.progress.toFixed(4));
      setLength(root, "--scroll-far-x", values.farX);
      setLength(root, "--scroll-far-y", values.farY);
      setLength(root, "--scroll-mid-x", values.midX);
      setLength(root, "--scroll-mid-y", values.midY);
      setLength(root, "--scroll-near-x", values.nearX);
      setLength(root, "--scroll-near-y", values.nearY);
      root.style.setProperty("--scroll-turn", `${values.turn.toFixed(3)}deg`);
    };

    const schedule = () => {
      if (motionPreference.matches || !isNearViewport || frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const intersection = new IntersectionObserver(
      ([entry]) => {
        isNearViewport = entry?.isIntersecting ?? false;
        if (isNearViewport && !motionPreference.matches) {
          root.dataset.scrollActive = "true";
          schedule();
        } else {
          root.removeAttribute("data-scroll-active");
        }
      },
      { rootMargin: "45% 0px" },
    );

    const resize = new ResizeObserver(schedule);
    const onPreferenceChange = () => {
      if (motionPreference.matches) clearMotion();
      else if (isNearViewport) {
        root.dataset.scrollActive = "true";
        schedule();
      }
    };

    intersection.observe(root);
    resize.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motionPreference.addEventListener("change", onPreferenceChange);
    update();

    return () => {
      intersection.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motionPreference.removeEventListener("change", onPreferenceChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className={`${styles.scene}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
