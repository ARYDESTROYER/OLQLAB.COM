import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
  },
}));

import { countResolvedAssessmentListStats } from "@/lib/assessment-access";

describe("resolved assessment status counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts sessions through the current-enrollment CTE and maps database counts", async () => {
    mocks.queryRaw.mockResolvedValue([{
      assessmentId: "assessment_1",
      participantCount: 3,
      completedCount: 2,
      inProgressCount: 1,
    }]);

    await expect(
      countResolvedAssessmentListStats(["assessment_1"]),
    ).resolves.toEqual({
      eligibleByAssessmentId: new Map([["assessment_1", 3]]),
      sessionCounts: [
        {
          assessmentId: "assessment_1",
          status: "SUBMITTED",
          _count: { _all: 2 },
        },
        {
          assessmentId: "assessment_1",
          status: "IN_PROGRESS",
          _count: { _all: 1 },
        },
      ],
    });

    const query = mocks.queryRaw.mock.calls[0]?.[0] as { sql: string };
    expect(query.sql).toContain('enrollment."active" = TRUE');
    expect(query.sql).toContain('FROM "AssessmentUnenrollJob" AS job');
    expect(query.sql).toContain('LEFT JOIN "QuizSession" AS session');
    expect(query.sql).toContain('session."userId" = eligible."userId"');
  });
});
