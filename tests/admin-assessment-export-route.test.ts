import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findAnswers: vi.fn(),
  findAssessments: vi.fn(),
  findReports: vi.fn(),
  findSessions: vi.fn(),
  findTenants: vi.fn(),
  listParticipants: vi.fn(),
  queryRaw: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/assessment-access", () => ({
  listResolvedAssessmentUsers: mocks.listParticipants,
  ResolvedAssessmentUsersLimitError: class ResolvedAssessmentUsersLimitError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    answer: { findMany: mocks.findAnswers },
    assessment: { findMany: mocks.findAssessments },
    quizSession: { findMany: mocks.findSessions },
    report: { findMany: mocks.findReports },
    tenant: { findMany: mocks.findTenants },
  },
}));

import { POST } from "@/app/api/admin/assessments/export-results/route";

const participant = {
  userId: "user_1",
  email: "participant@example.com",
  firstName: "Test",
  lastName: "Participant",
  role: "EMPLOYEE" as const,
  tenantId: "tenant_1",
  managerEmail: null,
  sources: [],
};

function exportRequest(include: {
  participant: boolean;
  attempt: boolean;
  report: boolean;
  answers: boolean;
}) {
  return new NextRequest("https://www.olqlab.com/api/admin/assessments/export-results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assessmentIds: ["assessment_1"], include }),
  });
}

describe("admin assessment export resource bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      session: { user: { id: "admin_1" } },
    });
    mocks.listParticipants.mockResolvedValue([participant]);
    mocks.findReports.mockResolvedValue([]);
    mocks.findSessions.mockResolvedValue([]);
    mocks.findTenants.mockResolvedValue([
      { id: "tenant_1", name: "Example", type: "ORGANIZATION" },
    ]);
  });

  it("does not query questions or answers when answers are excluded", async () => {
    mocks.findAssessments.mockResolvedValue([
      {
        id: "assessment_1",
        title: "Leadership",
        isPublished: true,
        policy: {
          reportWorkflow: "AI_STANDARD",
          showResultsToEmployee: true,
          resultReleaseDelayHours: 0,
        },
      },
    ]);

    const response = await POST(
      exportRequest({
        participant: true,
        attempt: false,
        report: false,
        answers: false,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findAssessments).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ questions: expect.anything() }),
      }),
    );
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(mocks.findAnswers).not.toHaveBeenCalled();
  });

  it("rejects oversized free text before answer hydration", async () => {
    mocks.findAssessments.mockResolvedValue([
      {
        id: "assessment_1",
        title: "Leadership",
        isPublished: true,
        policy: {
          reportWorkflow: "AI_STANDARD",
          showResultsToEmployee: true,
          resultReleaseDelayHours: 0,
        },
        questions: [
          {
            id: "question_1",
            code: "Q1",
            prompt: "Describe a difficult decision.",
            questionType: "FREE_TEXT",
            sortOrder: 0,
            options: [],
          },
        ],
      },
    ]);
    mocks.queryRaw.mockResolvedValue([
      {
        rawUtf8Bytes: BigInt(5 * 1024 * 1024),
        quoteCharacters: BigInt(0),
        values: BigInt(1),
      },
    ]);

    const response = await POST(
      exportRequest({
        participant: true,
        attempt: false,
        report: false,
        answers: true,
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("safe download size"),
    });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.findAnswers).not.toHaveBeenCalled();
  });
});
