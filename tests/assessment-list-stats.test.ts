import { describe, expect, it } from "vitest";
import { buildAssessmentParticipantStats } from "@/lib/assessment-list-stats";

describe("batched assessment list statistics", () => {
  it("merges grouped attempt counts without per-assessment queries", () => {
    const result = buildAssessmentParticipantStats(
      ["assessment-a", "assessment-b"],
      new Map([
        ["assessment-a", 10],
        ["assessment-b", 2],
      ]),
      [
        { assessmentId: "assessment-a", status: "SUBMITTED", _count: { _all: 4 } },
        { assessmentId: "assessment-a", status: "IN_PROGRESS", _count: { _all: 3 } },
        { assessmentId: "assessment-b", status: "SUBMITTED", _count: { _all: 3 } },
      ],
    );

    expect(result.get("assessment-a")).toEqual({
      total: 10,
      completed: 4,
      inProgress: 3,
      notStarted: 3,
      completionRate: 40,
    });
    expect(result.get("assessment-b")).toEqual({
      total: 2,
      completed: 2,
      inProgress: 0,
      notStarted: 0,
      completionRate: 100,
    });
  });

  it("always returns mutually exclusive status populations that add up to total", () => {
    const result = buildAssessmentParticipantStats(
      ["assessment-a"],
      new Map([["assessment-a", 2]]),
      [
        { assessmentId: "assessment-a", status: "SUBMITTED", _count: { _all: 1 } },
        { assessmentId: "assessment-a", status: "IN_PROGRESS", _count: { _all: 4 } },
      ],
    ).get("assessment-a")!;

    expect(result).toEqual({
      total: 2,
      completed: 1,
      inProgress: 1,
      notStarted: 0,
      completionRate: 50,
    });
    expect(result.completed + result.inProgress + result.notStarted).toBe(
      result.total,
    );
  });
});
