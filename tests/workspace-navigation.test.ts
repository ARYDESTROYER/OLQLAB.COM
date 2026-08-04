import { describe, expect, it } from "vitest";
import {
  getFocusedSessionNavigation,
  getWorkspaceWarmRoutes,
  hasParticipantWorkspaceAccess,
  shouldWarmWorkspaceRoutes,
  takeNextWorkspaceWarmRoute,
} from "../src/lib/workspace-navigation";

describe("workspace navigation policy", () => {
  it.each(["EMPLOYEE", "LEADER"] as const)(
    "preserves participant navigation for %s identities",
    (role) => {
      expect(hasParticipantWorkspaceAccess(role)).toBe(true);
      expect(getFocusedSessionNavigation("/assessment/session/session_123", role)).toEqual({
        exitHref: "/assessment/current",
        exitLabel: "Exit Assessment",
        showMyReports: true,
      });
    },
  );

  it("hides participant navigation for ADMIN identities", () => {
    expect(hasParticipantWorkspaceAccess("ADMIN")).toBe(false);
    expect(getFocusedSessionNavigation("/assessment/session/session_123", "ADMIN")).toEqual({
      exitHref: "/assessment/current",
      exitLabel: "Exit Assessment",
      showMyReports: false,
    });
  });

  it("returns admin preview sessions to assessment administration", () => {
    expect(getFocusedSessionNavigation("/assessment/session/preview_123", "ADMIN")).toEqual({
      exitHref: "/admin/assessments",
      exitLabel: "Exit Preview",
      showMyReports: false,
    });
  });

  it("warms only the top-level destinations available to each role", () => {
    expect(getWorkspaceWarmRoutes("EMPLOYEE")).toEqual([
      "/dashboard",
      "/assessment/current",
      "/reports/current",
    ]);
    expect(getWorkspaceWarmRoutes("LEADER")).toEqual([
      "/dashboard",
      "/assessment/current",
      "/reports/current",
      "/reports/team",
    ]);
    expect(getWorkspaceWarmRoutes("ADMIN")).toEqual([
      "/dashboard",
      "/admin",
    ]);

    for (const role of ["ADMIN", "EMPLOYEE", "LEADER"] as const) {
      const routes = getWorkspaceWarmRoutes(role);
      expect(new Set(routes).size).toBe(routes.length);
      expect(routes.every((route) => !route.includes("/session/"))).toBe(true);
    }
    expect(getWorkspaceWarmRoutes("ADMIN")).not.toContain("/assessment/current");
    expect(getWorkspaceWarmRoutes("EMPLOYEE")).not.toContain("/reports/team");
  });

  it("does not spend background bandwidth on data-saver or 2G connections", () => {
    expect(shouldWarmWorkspaceRoutes()).toBe(true);
    expect(shouldWarmWorkspaceRoutes({ effectiveType: "4g" })).toBe(true);
    expect(shouldWarmWorkspaceRoutes({ saveData: true })).toBe(false);
    expect(shouldWarmWorkspaceRoutes({ effectiveType: "2g" })).toBe(false);
    expect(shouldWarmWorkspaceRoutes({ effectiveType: "slow-2g" })).toBe(false);
  });

  it("advances past a route the user opened before its idle turn", () => {
    const routes = ["/dashboard", "/assessment/current", "/reports/current"];

    expect(takeNextWorkspaceWarmRoute(routes, 0, "/dashboard")).toEqual({
      href: "/assessment/current",
      nextIndex: 2,
    });
    expect(takeNextWorkspaceWarmRoute(routes, 2, "/reports/current")).toEqual({
      href: null,
      nextIndex: 3,
    });
  });
});
