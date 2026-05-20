"use client";

import { useEffect, useRef } from "react";

/**
 * Custom cursor: a small dot that follows the pointer exactly + a larger ring
 * that lerps behind. Both use mix-blend-mode so they read on any background.
 *
 * Activates only on fine pointers (no touch) and only when the user has not
 * requested reduced motion. Adds `cursor-active` to <html> so CSS can hide the
 * native cursor.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || !motionOk) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.documentElement.classList.add("cursor-active");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let visible = false;

    const setVisible = (v: boolean) => {
      if (v === visible) return;
      visible = v;
      dot.classList.toggle("cursor-dot--hidden", !v);
      ring.classList.toggle("cursor-ring--hidden", !v);
    };

    const handleMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      setVisible(true);
    };

    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    const isInteractive = (el: Element | null): boolean => {
      if (!el) return false;
      return Boolean(
        el.closest(
          'a, button, [role="button"], label, [data-cursor="hover"]',
        ),
      );
    };

    const isText = (el: Element | null): boolean => {
      if (!el) return false;
      return Boolean(el.closest('input, textarea, [contenteditable="true"]'));
    };

    const handleOver = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (isText(target)) {
        ring.classList.add("cursor-ring--text");
        ring.classList.remove("cursor-ring--hover");
      } else if (isInteractive(target)) {
        ring.classList.add("cursor-ring--hover");
        ring.classList.remove("cursor-ring--text");
      } else {
        ring.classList.remove("cursor-ring--hover");
        ring.classList.remove("cursor-ring--text");
      }
    };

    let raf = 0;
    const tick = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    document.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseover", handleOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleLeave);
    document.documentElement.addEventListener("mouseenter", handleEnter);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseover", handleOver);
      document.documentElement.removeEventListener("mouseleave", handleLeave);
      document.documentElement.removeEventListener("mouseenter", handleEnter);
      document.documentElement.classList.remove("cursor-active");
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        className="cursor-ring cursor-ring--hidden"
      />
      <div
        ref={dotRef}
        aria-hidden
        className="cursor-dot cursor-dot--hidden"
      />
    </>
  );
}
