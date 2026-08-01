"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * Wraps children in a span that subtly leans toward the cursor on hover,
 * springing back when the cursor leaves. Used on primary CTAs to give them a
 * little bit of weight under the cursor.
 */
export default function Magnetic({
  children,
  strength = 0.18,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    const finePointer = window.matchMedia("(pointer: fine)");
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let point: { x: number; y: number } | null = null;

    const reset = () => {
      point = null;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      el.style.transform = "translate3d(0, 0, 0)";
    };

    const update = () => {
      frame = 0;
      if (!point || !finePointer.matches || motionPreference.matches) {
        reset();
        return;
      }

      const rect = el.getBoundingClientRect();
      const x = point.x - (rect.left + rect.width / 2);
      const y = point.y - (rect.top + rect.height / 2);
      el.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`;
    };

    const onMove = (e: MouseEvent) => {
      if (!finePointer.matches || motionPreference.matches) return;
      point = { x: e.clientX, y: e.clientY };
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const onPreferenceChange = () => reset();

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);
    finePointer.addEventListener("change", onPreferenceChange);
    motionPreference.addEventListener("change", onPreferenceChange);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", reset);
      finePointer.removeEventListener("change", onPreferenceChange);
      motionPreference.removeEventListener("change", onPreferenceChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [strength]);

  return (
    <span ref={ref} className={`magnetic ${className}`}>
      {children}
    </span>
  );
}
