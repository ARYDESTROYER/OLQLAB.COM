"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll-triggered reveal driver.
 *
 * Watches every element with `.reveal-on-scroll`, `.scale-on-scroll`,
 * `.image-mask`, or `.reveal-words` and adds `is-revealed` the first time it
 * enters the viewport. The one-way reveal keeps content visible after entry
 * and avoids distracting replay while visitors scan back up a page.
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
            observer.unobserve(entry.target);
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
