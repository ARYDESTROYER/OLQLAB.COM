import { describe, expect, it } from "vitest";
import {
  buildAdminListWindowMeta,
  getAdminCsvWindowError,
} from "@/lib/admin-list-window";

describe("admin list windows", () => {
  it("marks a bounded list as incomplete without inventing an exact derived total", () => {
    expect(
      buildAdminListWindowMeta({
        returned: 40,
        limit: 100,
        totalCandidates: 900,
        processedCandidates: 500,
        matchingWithinWindow: 40,
        derivedFilterApplied: true,
      }),
    ).toEqual({
      returned: 40,
      limit: 100,
      totalMatchingFilters: null,
      totalCandidates: 900,
      hasMore: true,
      truncated: true,
    });
  });

  it("reports exact totals when every candidate was evaluated", () => {
    expect(
      buildAdminListWindowMeta({
        returned: 12,
        limit: 100,
        totalCandidates: 50,
        processedCandidates: 50,
        matchingWithinWindow: 12,
        derivedFilterApplied: true,
      }).totalMatchingFilters,
    ).toBe(12);
  });

  it("rejects CSV windows that would otherwise look complete", () => {
    expect(
      getAdminCsvWindowError({
        totalCandidates: 5_001,
        limit: 5_000,
        recordLabel: "users",
      }),
    ).toContain("more than 5,000 users");
    expect(
      getAdminCsvWindowError({
        totalCandidates: 5_000,
        limit: 5_000,
        recordLabel: "users",
      }),
    ).toBeNull();

    expect(
      getAdminCsvWindowError({
        totalCandidates: 5_001,
        limit: 5_000,
        recordLabel: "assessments",
        derivedFilterApplied: true,
      }),
    ).toContain("cannot safely evaluate more than 5,000 candidate assessments");
  });
});
