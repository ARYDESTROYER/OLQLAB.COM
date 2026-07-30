"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll-triggered reveal driver.
 *
 * Watches every element with `.reveal-on-scroll`, `.scale-on-scroll`,
 * `.image-mask`, or `.reveal-words` and toggles `is-revealed` on it as it
 * crosses into / out of the viewport.
 *
 * Bidirectional: animations re-play whenever an element enters the viewport
 * from any direction (scrolling down past it, then scrolling back up — both
 * trigger a fresh reveal).
 *
 * `rootMargin: "0px 0px -10% 0px"` delays the reveal slightly so elements
 * animate in once they are comfortably in view rather than the moment they
 * touch the bottom edge.
 *
 * Re-scans on DOM mutations so client-navigated pages pick up newly-mounted
 * reveal targets.
 */
export default function ScrollReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (/^\/(?:dashboard|admin|assessment|reports)(?:\/|$)/.test(pathname)) return;

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
          } else {
            entry.target.classList.remove("is-revealed");
          }
        }
      },
      {
        threshold: 0,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    const observeAll = () => {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        observer.observe(el);
      });
    };

    observeAll();

    const mutation = new MutationObserver(() => observeAll());
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, [pathname]);

  return null;
}
