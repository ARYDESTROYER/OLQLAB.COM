import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  clear: vi.fn(),
  generateAi: vi.fn(),
  resolveAccess: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireSession: async () => ({
    session: { user: { id: "user-1", role: "EMPLOYEE" } },
    liveUser: { id: "user-1", role: "EMPLOYEE" },
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    quizSession: { findUnique: vi.fn() },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/assessment-access", () => ({
  resolveAssessmentAccess: mocks.resolveAccess,
}));
vi.mock("@/lib/score", () => ({
  computeScores: () => ({
    traits: {
      openness: 60,
      conscientiousness: 70,
      extraversion: 50,
      agreeableness: 65,
      neuroticism: 30,
    },
    competencies: [],
  }),
  generateNarrative: () => ({ summary: "Ready" }),
}));
vi.mock("@/lib/ai-report", () => ({ generateAiNarrative: mocks.generateAi }));
vi.mock("@/lib/report-format", () => ({ buildReportHtmlTemplate: () => "<p>Ready</p>" }));
vi.mock("@/lib/report-content", () => ({ canonicalizeReportNarrative: (value: unknown) => value }));
vi.mock("@/lib/report-delivery", () => ({ sendManualSubmissionAlertEmails: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/lib/report-privacy", () => ({ participantReference: () => "participant-ref" }));
vi.mock("@/lib/assessment-submission-claim", () => ({
  acquireAssessmentSubmissionClaim: mocks.acquire,
  clearAssessmentSubmissionClaim: mocks.clear,
  verifyAssessmentSubmissionClaim: vi.fn(),
}));

import { db } from "@/lib/db";
import { POST } from "@/app/api/assessment/sessions/[id]/submit/route";

const session = {
  id: "session-1",
  assessmentId: "assessment-1",
  userId: "user-1",
  status: "IN_PROGRESS",
  startedAt: new Date("2026-07-30T11:00:00.000Z"),
  assessment: {
    id: "assessment-1",
    title: "Leadership",
    policy: { reportWorkflow: "AI_STANDARD", postSubmitMessage: "Done" },
    questions: [
      {
        id: "question-1",
        code: "Q1",
        sectionId: null,
        prompt: "Question",
        imageUrl: null,
        imageAlt: null,
        imageCaption: null,
        questionType: "LIKERT_TRAIT",
        scaleMin: 1,
        scaleMax: 5,
        options: [],
      },
    ],
  },
  answers: [
    { questionId: "question-1", value: 4, optionId: null, textValue: null },
  ],
  user: { firstName: "Asha", lastName: "Rao" },
};

function submit() {
  return POST(new Request("https://www.olqlab.com/api/assessment/sessions/session-1/submit") as never, {
    params: Promise.resolve({ id: "session-1" }),
  });
}

describe("AI submission claim orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.quizSession.findUnique).mockResolvedValue(session as never);
    mocks.resolveAccess.mockResolvedValue({
      canStartAssessment: true,
      enrollmentReportMode: "AUTO",
      enrollmentReportDelayHours: 0,
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({}),
    );
    mocks.clear.mockResolvedValue(true);
  });

  it("returns 409 without invoking the LLM for a parallel live claim", async () => {
    mocks.acquire.mockResolvedValue({ kind: "IN_PROGRESS", retryAfterSeconds: 240 });

    const response = await submit();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUBMISSION_IN_PROGRESS",
      retryAfterSeconds: 240,
    });
    expect(mocks.generateAi).not.toHaveBeenCalled();
  });

  it("clears the exact claim when LLM generation fails", async () => {
    mocks.acquire.mockResolvedValue({
      kind: "CLAIMED",
      answerSnapshotHash: "snapshot-hash",
    });
    mocks.generateAi.mockRejectedValue(new Error("LLM unavailable"));

    await expect(submit()).rejects.toThrow("LLM unavailable");

    expect(mocks.clear).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ sessionId: "session-1" }),
    );
  });
});

