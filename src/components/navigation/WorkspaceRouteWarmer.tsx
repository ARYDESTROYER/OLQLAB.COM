"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  getWorkspaceWarmRoutes,
  shouldWarmWorkspaceRoutes,
  takeNextWorkspaceWarmRoute,
  type WorkspaceConnectionSnapshot,
  type WorkspaceRole,
} from "@/lib/workspace-navigation";

type ConnectionAwareNavigator = Navigator & {
  connection?: WorkspaceConnectionSnapshot & {
    addEventListener?: (type: "change", listener: () => void) => void;
    removeEventListener?: (type: "change", listener: () => void) => void;
  };
};

type IdleWindow = {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
};

/**
 * Warms the authenticated route shells once the current page is idle.
 *
 * `router.prefetch()` intentionally keeps Next's automatic/partial strategy. It
 * primes route code, shared layouts, and loading boundaries without opting into
 * a five-minute full-page cache of authorization-sensitive server data.
 */
export default function WorkspaceRouteWarmer({ role }: { role: WorkspaceRole }) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const connection = (navigator as ConnectionAwareNavigator).connection;
    const routes = getWorkspaceWarmRoutes(role).filter(
      (href) => href !== window.location.pathname,
    );
    const idleWindow = window as unknown as IdleWindow;
    let routeIndex = 0;
    let cancelled = false;
    let scheduledHandle: number | null = null;
    let scheduledWithIdleCallback = false;

    function canWarmNow() {
      return (
        navigator.onLine &&
        document.visibilityState === "visible" &&
        shouldWarmWorkspaceRoutes(connection)
      );
    }

    function scheduleNext() {
      if (
        cancelled ||
        scheduledHandle !== null ||
        routeIndex >= routes.length ||
        !canWarmNow()
      ) {
        return;
      }

      if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
        scheduledWithIdleCallback = true;
        scheduledHandle = idleWindow.requestIdleCallback(warmNext, {
          timeout: 1_500,
        });
        return;
      }

      scheduledWithIdleCallback = false;
      scheduledHandle = window.setTimeout(warmNext, routeIndex === 0 ? 500 : 180);
    }

    function warmNext() {
      scheduledHandle = null;
      if (cancelled || !canWarmNow()) return;

      const step = takeNextWorkspaceWarmRoute(
        routes,
        routeIndex,
        window.location.pathname,
      );
      const href = step.href;
      routeIndex = step.nextIndex;
      if (!href) return;

      router.prefetch(href);
      scheduleNext();
    }

    function resumeWhenVisible() {
      if (document.visibilityState === "visible") scheduleNext();
    }

    function resumeWhenOnline() {
      scheduleNext();
    }

    function resumeWhenConnectionAllows() {
      scheduleNext();
    }

    document.addEventListener("visibilitychange", resumeWhenVisible);
    window.addEventListener("online", resumeWhenOnline);
    connection?.addEventListener?.("change", resumeWhenConnectionAllows);
    scheduleNext();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      window.removeEventListener("online", resumeWhenOnline);
      connection?.removeEventListener?.("change", resumeWhenConnectionAllows);
      if (scheduledHandle === null) return;
      if (scheduledWithIdleCallback && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(scheduledHandle);
      } else {
        window.clearTimeout(scheduledHandle);
      }
    };
  }, [role, router]);

  return null;
}
