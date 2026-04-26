"use client";

import { useEffect } from "react";

/**
 * Scroll-triggered reveal driver.
 *
 * Watches every element with `.reveal-on-scroll`, `.scale-on-scroll`, or
 * `.image-mask` and toggles `is-revealed` on it the moment it crosses into
 * the viewport. The matching CSS rules in globals.css then transition the
 * element from its hidden state to its revealed state.
 *
 * Re-scans the DOM on each navigation (mutation observer) so client-side
 * route changes pick up freshly-rendered reveal targets.
 */
export default function ScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SELECTOR =
      ".reveal-on-scroll, .scale-on-scroll, .image-mask, .reveal-words";
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        el.classList.add("is-revealed");
      });
      return;
    }

    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    const observeAll = () => {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        // If the element is already in view at mount, the observer will fire
        // immediately on the first frame. No special-case needed.
        observer.observe(el);
      });
    };

    observeAll();

    // Watch for new reveal targets added later (route changes, dynamic UI).
    const mutation = new MutationObserver(() => observeAll());
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);

  return null;
}
