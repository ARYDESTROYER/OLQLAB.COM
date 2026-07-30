import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findReports: vi.fn(),
  findSessions: vi.fn(),
  requireLeaderOrAdmin: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireLeaderOrAdmin: mocks.requireLeaderOrAdmin,
}));

vi.mock("@/lib/db", () => ({
  db: {
    quizSession: { findMany: mocks.findSessions },
    report: { findMany: mocks.findReports },
  },
}));

import { GET } from "@/app/api/reports/leader/route";

const policy = {
  leaderCanViewFullReport: true,
  reportWorkflow: "AI_STANDARD" as const,
  showResultsToEmployee: true,
  resultReleaseDelayHours: 0,
};

function session(index: number) {
  return {
    id: `session_${String(index).padStart(2, "0")}`,
    userId: `user_${index}`,
    assessmentId: `assessment_${index}`,
    submittedAt: new Date("2026-07-30T10:15:00.000Z"),
    user: { firstName: "Team", lastName: `Member ${index}` },
    assessment: { title: `Assessment ${index}`, policy },
  };
}

describe("leader report discovery pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireLeaderOrAdmin.mockResolvedValue({
      liveUser: {
        id: "leader_1",
        role: "LEADER",
        tenantId: "tenant_1",
      },
    });
    mocks.findReports.mockResolvedValue([]);
  });

  it("returns a cursor after one bounded page and applies it to the next page", async () => {
    mocks.findSessions.mockResolvedValueOnce(
      Array.from({ length: 31 }, (_, index) => session(index)),
    );

    const firstResponse = await GET(
      new Request("https://www.olqlab.com/api/reports/leader"),
    );
    const firstPage = (await firstResponse.json()) as {
      reports: unknown[];
      nextCursor: string | null;
    };

    expect(firstResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(firstPage.reports).toHaveLength(30);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(mocks.findSessions).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: 31,
        orderBy: [
          { submittedAt: { sort: "desc", nulls: "last" } },
          { id: "desc" },
        ],
      }),
    );

    mocks.findSessions.mockResolvedValueOnce([session(31)]);
    const secondResponse = await GET(
      new Request(
        `https://www.olqlab.com/api/reports/leader?cursor=${encodeURIComponent(firstPage.nextCursor || "")}`,
      ),
    );
    const secondPage = (await secondResponse.json()) as {
      reports: unknown[];
      nextCursor: string | null;
    };
    const secondQuery = mocks.findSessions.mock.calls[1]?.[0] as {
      where: { OR?: unknown[] };
    };

    expect(secondPage.reports).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(secondQuery.where.OR).toEqual([
      { submittedAt: { lt: new Date("2026-07-30T10:15:00.000Z") } },
      {
        submittedAt: new Date("2026-07-30T10:15:00.000Z"),
        id: { lt: "session_29" },
      },
      { submittedAt: null },
    ]);
  });

  it("rejects an invalid cursor without querying report data", async () => {
    const response = await GET(
      new Request("https://www.olqlab.com/api/reports/leader?cursor=invalid"),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Invalid pagination cursor.",
    });
    expect(mocks.findSessions).not.toHaveBeenCalled();
    expect(mocks.findReports).not.toHaveBeenCalled();
  });
});
