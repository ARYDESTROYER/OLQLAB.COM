import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  ai: vi.fn(),
  archive: vi.fn(),
  findInitialSession: vi.fn(),
  findLockedSession: vi.fn(),
  lock: vi.fn(),
  reportUpsert: vi.fn(),
  scoreUpsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: async () => ({
    session: { user: { id: "admin-1", role: "ADMIN" } },
    liveUser: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
  }),
}));
vi.mock("@/lib/ai-report", () => ({ generateAiNarrative: mocks.ai }));
vi.mock("@/lib/score", () => ({
  computeScores: () => ({
    traits: {
      openness: 50,
      conscientiousness: 50,
      extraversion: 50,
      agreeableness: 50,
      neuroticism: 50,
    },
    competencies: {},
  }),
  generateNarrative: () => ({ summary: "Ready" }),
}));
vi.mock("@/lib/report-format", () => ({
  buildReportHtmlTemplate: () => "<p>Ready</p>",
}));
vi.mock("@/lib/report-privacy", () => ({
  participantReference: () => "participant-reference",
}));
vi.mock("@/lib/report-archive", () => ({ archiveCurrentAttempt: mocks.archive }));
vi.mock("@/lib/audit-log", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    quizSession: { findUnique: mocks.findInitialSession },
  },
}));

import { POST } from "@/app/api/admin/reports/regenerate/route";

describe("report regeneration attempt binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const submittedAt = new Date("2026-07-30T10:00:00.000Z");
    mocks.findInitialSession.mockResolvedValue({
      id: "session-1",
      status: "SUBMITTED",
      submittedAt,
      answers: [
        { questionId: "question-1", value: 4, optionId: null, textValue: null },
      ],
      assessment: {
        title: "Leadership Snapshot",
        questions: [],
      },
      user: {
        id: "user-1",
        firstName: "Asha",
        lastName: "Rao",
        tenantId: "tenant-1",
      },
    });
    mocks.findLockedSession.mockResolvedValue({
      status: "IN_PROGRESS",
      submittedAt: null,
      answers: [],
    });
    mocks.ai.mockResolvedValue({ summary: "Prepared" });
    mocks.lock.mockResolvedValue([{ lockResult: null }]);
    mocks.transaction.mockImplementation(
      async (callback: (client: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: mocks.lock,
          assessmentReportShareToken: { updateMany: vi.fn() },
          quizSession: { findUnique: mocks.findLockedSession },
          report: { upsert: mocks.reportUpsert },
          score: { upsert: mocks.scoreUpsert },
        }),
    );
  });

  it("returns 409 without archiving or writing when reset wins during AI work", async () => {
    const response = await POST(
      new NextRequest("https://www.olqlab.test/api/admin/reports/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: "assessment-1", userId: "user-1" }),
      }),
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("ATTEMPT_CHANGED");
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.scoreUpsert).not.toHaveBeenCalled();
    expect(mocks.reportUpsert).not.toHaveBeenCalled();
  });
});
