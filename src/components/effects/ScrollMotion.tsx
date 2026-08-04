"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  calculateScrollMotion,
  calculateStickyScrollProgress,
} from "@/lib/scroll-motion";
import styles from "./ScrollMotion.module.css";

type ScrollMotionProps = {
  children: ReactNode;
  className?: string;
  enhancementQuery?: string;
  progressMode?: "viewport" | "sticky";
  stickyOffset?: number;
};

type MotionSubscriber = () => void;

const motionSubscribers = new Set<MotionSubscriber>();
let sharedMotionFrame = 0;

function flushMotionSubscribers() {
  sharedMotionFrame = 0;
  motionSubscribers.forEach((subscriber) => subscriber());
}

function scheduleSharedMotionFrame() {
  if (sharedMotionFrame) return;
  sharedMotionFrame = window.requestAnimationFrame(flushMotionSubscribers);
}

function subscribeToViewportMotion(subscriber: MotionSubscriber) {
  motionSubscribers.add(subscriber);

  if (motionSubscribers.size === 1) {
    window.addEventListener("scroll", scheduleSharedMotionFrame, {
      passive: true,
    });
    window.addEventListener("resize", scheduleSharedMotionFrame, {
      passive: true,
    });
  }

  return () => {
    motionSubscribers.delete(subscriber);
    if (motionSubscribers.size > 0) return;

    window.removeEventListener("scroll", scheduleSharedMotionFrame);
    window.removeEventListener("resize", scheduleSharedMotionFrame);
    if (sharedMotionFrame) {
      window.cancelAnimationFrame(sharedMotionFrame);
      sharedMotionFrame = 0;
    }
  };
}

function setLength(root: HTMLDivElement, property: string, value: number) {
  root.style.setProperty(property, `${value.toFixed(2)}px`);
}

export default function ScrollMotion({
  children,
  className,
  enhancementQuery,
  progressMode = "viewport",
  stickyOffset = 0,
}: ScrollMotionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneId = useId();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");
    const enhancementCapability = enhancementQuery
      ? window.matchMedia(enhancementQuery)
      : null;
    let isNearViewport = true;
    let unsubscribeViewport: (() => void) | null = null;
    let ownedLayers = new Set<HTMLElement>();
    let ownedAmbientNodes = new Set<HTMLElement>();
    const motionIsDisabled = () =>
      motionPreference.matches ||
      coarsePointer.matches ||
      enhancementCapability?.matches === false;

    const isOwnedByRoot = (element: Element) =>
      element.closest("[data-scroll-scene]") === root;

    const refreshOwnedNodes = () => {
      const nextLayers = new Set(
        Array.from(
          root.querySelectorAll<HTMLElement>("[data-scroll-layer]"),
        ).filter(isOwnedByRoot),
      );
      const nextAmbientNodes = new Set(
        Array.from(root.querySelectorAll<HTMLElement>("[data-ambient]")).filter(
          isOwnedByRoot,
        ),
      );

      ownedLayers.forEach((element) => {
        if (nextLayers.has(element) || element.dataset.scrollOwner !== sceneId)
          return;
        delete element.dataset.scrollOwner;
        delete element.dataset.scrollEnhancedOwner;
        delete element.dataset.scrollActiveOwner;
      });
      ownedAmbientNodes.forEach((element) => {
        if (
          nextAmbientNodes.has(element) ||
          element.dataset.scrollAmbientOwner !== sceneId
        ) {
          return;
        }
        delete element.dataset.scrollAmbientOwner;
        delete element.dataset.scrollAmbientActiveOwner;
      });

      nextLayers.forEach((element) => {
        element.dataset.scrollOwner = sceneId;
      });
      nextAmbientNodes.forEach((element) => {
        element.dataset.scrollAmbientOwner = sceneId;
      });

      ownedLayers = nextLayers;
      ownedAmbientNodes = nextAmbientNodes;
    };

    const setActive = (active: boolean) => {
      if (active) root.dataset.scrollActive = "true";
      else root.removeAttribute("data-scroll-active");
      ownedLayers.forEach((element) => {
        if (active) element.dataset.scrollActiveOwner = sceneId;
        else if (element.dataset.scrollActiveOwner === sceneId) {
          delete element.dataset.scrollActiveOwner;
        }
      });
      ownedAmbientNodes.forEach((element) => {
        if (active) element.dataset.scrollAmbientActiveOwner = sceneId;
        else if (element.dataset.scrollAmbientActiveOwner === sceneId) {
          delete element.dataset.scrollAmbientActiveOwner;
        }
      });
    };

    const clearMotion = () => {
      root.removeAttribute("data-scroll-enhanced");
      setActive(false);
      root.style.setProperty("--scroll-progress", "1");
      root.style.setProperty("--scroll-progress-eased", "1");
      [
        "--scroll-far-x",
        "--scroll-far-y",
        "--scroll-mid-x",
        "--scroll-mid-y",
        "--scroll-near-x",
        "--scroll-near-y",
      ].forEach((property) => root.style.setProperty(property, "0px"));
      root.style.setProperty("--scroll-turn", "0deg");
      ownedLayers.forEach((element) => {
        if (element.dataset.scrollEnhancedOwner === sceneId) {
          delete element.dataset.scrollEnhancedOwner;
        }
      });
    };

    const update = () => {
      if (motionIsDisabled()) {
        clearMotion();
        return;
      }

      const rect = root.getBoundingClientRect();
      const values = calculateScrollMotion(
        rect.top,
        rect.height,
        window.innerHeight,
      );
      const progress =
        progressMode === "sticky"
          ? calculateStickyScrollProgress(
              rect.top,
              rect.height,
              window.innerHeight,
              stickyOffset,
            )
          : values.progress;
      root.dataset.scrollEnhanced = "true";
      root.style.setProperty("--scroll-progress", progress.toFixed(4));
      root.style.setProperty(
        "--scroll-progress-eased",
        (progress * progress).toFixed(4),
      );
      setLength(root, "--scroll-far-x", values.farX);
      setLength(root, "--scroll-far-y", values.farY);
      setLength(root, "--scroll-mid-x", values.midX);
      setLength(root, "--scroll-mid-y", values.midY);
      setLength(root, "--scroll-near-x", values.nearX);
      setLength(root, "--scroll-near-y", values.nearY);
      root.style.setProperty("--scroll-turn", `${values.turn.toFixed(3)}deg`);
      ownedLayers.forEach((element) => {
        element.dataset.scrollEnhancedOwner = sceneId;
      });
    };

    const updateIfNearViewport = () => {
      if (isNearViewport) update();
    };

    const startViewportSubscription = () => {
      if (!unsubscribeViewport) {
        unsubscribeViewport = subscribeToViewportMotion(updateIfNearViewport);
      }
    };

    const stopViewportSubscription = () => {
      unsubscribeViewport?.();
      unsubscribeViewport = null;
    };

    refreshOwnedNodes();

    if (
      typeof IntersectionObserver === "undefined" ||
      typeof ResizeObserver === "undefined"
    ) {
      clearMotion();
      return;
    }

    const intersection = new IntersectionObserver(
      ([entry]) => {
        isNearViewport = entry?.isIntersecting ?? false;
        if (isNearViewport && !motionIsDisabled()) {
          setActive(true);
          scheduleSharedMotionFrame();
        } else {
          setActive(false);
        }
      },
      { rootMargin: "45% 0px" },
    );

    const resize = new ResizeObserver(() => {
      refreshOwnedNodes();
      if (isNearViewport) scheduleSharedMotionFrame();
    });
    const onMotionCapabilityChange = () => {
      if (motionIsDisabled()) {
        stopViewportSubscription();
        clearMotion();
      } else {
        startViewportSubscription();
      }

      if (!motionIsDisabled() && isNearViewport) {
        setActive(true);
        scheduleSharedMotionFrame();
      }
    };

    if (!motionIsDisabled()) startViewportSubscription();
    intersection.observe(root);
    resize.observe(root);
    motionPreference.addEventListener("change", onMotionCapabilityChange);
    coarsePointer.addEventListener("change", onMotionCapabilityChange);
    enhancementCapability?.addEventListener("change", onMotionCapabilityChange);
    update();

    return () => {
      intersection.disconnect();
      resize.disconnect();
      stopViewportSubscription();
      motionPreference.removeEventListener("change", onMotionCapabilityChange);
      coarsePointer.removeEventListener("change", onMotionCapabilityChange);
      enhancementCapability?.removeEventListener("change", onMotionCapabilityChange);
      clearMotion();
      ownedLayers.forEach((element) => {
        if (element.dataset.scrollOwner === sceneId)
          delete element.dataset.scrollOwner;
      });
      ownedAmbientNodes.forEach((element) => {
        if (element.dataset.scrollAmbientOwner === sceneId) {
          delete element.dataset.scrollAmbientOwner;
        }
      });
    };
  }, [enhancementQuery, progressMode, sceneId, stickyOffset]);

  return (
    <div
      ref={rootRef}
      className={`${styles.scene}${className ? ` ${className}` : ""}`}
      data-scroll-scene={sceneId}
      data-scroll-progress-mode={progressMode}
    >
      {children}
    </div>
  );
}
