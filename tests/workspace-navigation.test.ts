import { describe, expect, it } from "vitest";
import {
  getFocusedSessionNavigation,
  hasParticipantWorkspaceAccess,
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
});
