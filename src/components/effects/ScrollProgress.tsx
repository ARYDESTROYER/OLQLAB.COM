"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const MARKETING_ROUTES = new Set([
  "/",
  "/about",
  "/framework",
  "/assessments",
  "/coaching",
  "/blindspot",
  "/work",
  "/contact",
  "/oql",
]);

/**
 * Thin ink-on-rule progress bar fixed to the top of the viewport. Updates a
 * CSS custom property `--scroll-progress` (0 → 1) on the bar element which the
 * stylesheet uses to scale a fill ::after.
 */
export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const enabled = MARKETING_ROUTES.has(pathname);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let raf = 0;
    let tracking = false;
    const update = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const ratio =
        scrollable > 0
          ? Math.min(1, Math.max(0, doc.scrollTop / scrollable))
          : 0;
      el.style.setProperty("--scroll-progress", String(ratio));
      raf = 0;
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    const stopTracking = () => {
      if (!tracking) return;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      tracking = false;
    };

    const startTracking = () => {
      if (tracking || motionPreference.matches) return;
      tracking = true;
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    };

    const onPreferenceChange = () => {
      if (motionPreference.matches) {
        stopTracking();
        el.style.setProperty("--scroll-progress", "0");
      } else {
        startTracking();
      }
    };

    motionPreference.addEventListener("change", onPreferenceChange);
    startTracking();

    return () => {
      motionPreference.removeEventListener("change", onPreferenceChange);
      stopTracking();
    };
  }, [enabled]);

  if (!enabled) return null;

  return <div ref={ref} className="scroll-progress" aria-hidden />;
}
