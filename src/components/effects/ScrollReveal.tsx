"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REVEAL_SELECTOR =
  "[data-reveal], [data-reveal-group], [data-reveal-parts], .reveal-on-scroll, .scale-on-scroll, .image-mask, .reveal-words";

/**
 * Scroll-triggered reveal driver.
 *
 * Watches the legacy reveal classes plus the declarative `[data-reveal]` and
 * `[data-reveal-group]` variants. A reveal group staggers its direct
 * `[data-reveal-item]` children in DOM order; callers can override the generated
 * `--reveal-index` custom property when a visual order differs from DOM order.
 *
 * The one-way reveal keeps content visible after entry. Mutation bursts are
 * folded into a single animation-frame scan so a client navigation cannot
 * trigger repeated full-document queries in the same frame.
 */
export default function ScrollReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (/^\/(?:dashboard|admin|assessment|reports)(?:\/|$)/.test(pathname)) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    const prepareRevealGroup = (element: Element) => {
      if (!(element instanceof HTMLElement) || !element.hasAttribute("data-reveal-group")) {
        return;
      }

      Array.from(element.children)
        .filter((child): child is HTMLElement =>
          child instanceof HTMLElement && child.hasAttribute("data-reveal-item"),
        )
        .forEach((child, index) => {
          if (!child.style.getPropertyValue("--reveal-index")) {
            child.style.setProperty("--reveal-index", String(index));
          }
          if (!child.style.getPropertyValue("--reveal-delay")) {
            child.style.setProperty("--reveal-delay", `${Math.min(index, 8) * 70}ms`);
          }
        });
    };

    let observer: IntersectionObserver | null = null;
    const reveal = (element: Element, immediately = false) => {
      prepareRevealGroup(element);
      if (immediately && element instanceof HTMLElement) {
        element.dataset.revealFocus = "true";
      }
      element.classList.add("is-revealed");
      element.removeAttribute("data-reveal-pending");
      observer?.unobserve(element);
    };

    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll(REVEAL_SELECTOR).forEach((element) => reveal(element));
      return;
    }

    const observed = new WeakSet<Element>();
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target);
        }
      },
      {
        threshold: 0,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    const scan = () => {
      document.querySelectorAll(REVEAL_SELECTOR).forEach((element) => {
        prepareRevealGroup(element);
        if (motionPreference.matches || element.classList.contains("is-revealed")) {
          reveal(element);
          return;
        }
        if (observed.has(element)) return;
        observed.add(element);
        element.setAttribute("data-reveal-pending", "true");
        observer?.observe(element);
      });
    };

    let scanFrame = 0;
    const scheduleScan = () => {
      if (scanFrame) return;
      scanFrame = window.requestAnimationFrame(() => {
        scanFrame = 0;
        scan();
      });
    };

    const onPreferenceChange = () => scan();
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      let revealTarget: Element | null = event.target.closest(REVEAL_SELECTOR);
      while (revealTarget) {
        reveal(revealTarget, true);
        revealTarget = revealTarget.parentElement?.closest(REVEAL_SELECTOR) ?? null;
      }
    };

    scan();

    const mutation = new MutationObserver(scheduleScan);
    mutation.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn, true);
    motionPreference.addEventListener("change", onPreferenceChange);

    return () => {
      observer?.disconnect();
      mutation.disconnect();
      document.removeEventListener("focusin", onFocusIn, true);
      motionPreference.removeEventListener("change", onPreferenceChange);
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
    };
  }, [pathname]);

  return null;
}
