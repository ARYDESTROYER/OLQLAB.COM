import { describe, expect, it, vi } from "vitest";
import { archiveCurrentAttempt } from "@/lib/report-archive";

describe("attempt archive question evidence", () => {
  it("captures every question scalar, including the participant image", async () => {
    const question = {
      id: "question-1",
      assessmentId: "assessment-1",
      sectionId: "section-1",
      code: "Q1",
      prompt: "What would you do?",
      imageUrl: "/question-images/scenario.png",
      imageAlt: "A project board",
      imageCaption: "Use the scene as context.",
      questionType: "FREE_TEXT",
      category: "Judgement",
      trait: null,
      reverse: false,
      scaleMin: 1,
      scaleMax: 1,
      sortOrder: 0,
    };
    const createArchive = vi.fn(async ({ data }: { data: unknown }) => data);
    const findSession = vi.fn(async () => ({
      id: "session-1",
      startedAt: new Date("2026-07-30T08:00:00.000Z"),
      submittedAt: new Date("2026-07-30T08:15:00.000Z"),
      user: { firstName: "Asha", lastName: "Rao" },
      assessment: { title: "Leadership" },
      answers: [
        {
          value: null,
          textValue: "I would ask what is blocked.",
          optionId: null,
          createdAt: new Date("2026-07-30T08:10:00.000Z"),
          updatedAt: new Date("2026-07-30T08:10:00.000Z"),
          question,
          option: null,
        },
      ],
    }));
    const tx = {
      quizSession: { findUnique: findSession },
      score: { findUnique: vi.fn(async () => null) },
      report: { findUnique: vi.fn(async () => null) },
      reportArchive: { create: createArchive },
    };

    await archiveCurrentAttempt(tx as never, {
      assessmentId: "assessment-1",
      userId: "user-1",
      reason: "scheduled_retest_started",
    });

    expect(findSession).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          answers: expect.objectContaining({
            select: expect.objectContaining({
              question: {
                select: expect.objectContaining({
                  imageUrl: true,
                  imageAlt: true,
                  imageCaption: true,
                  sectionId: true,
                  sortOrder: true,
                }),
              },
            }),
          }),
        }),
      }),
    );

    const archiveData = createArchive.mock.calls[0]?.[0] as {
      data: { narrativeJson: string };
    };
    const narrative = JSON.parse(archiveData.data.narrativeJson) as {
      _olqArchive: {
        version: number;
        session: { answers: Array<{ question: typeof question }> };
      };
    };
    expect(narrative._olqArchive.version).toBe(3);
    expect(narrative._olqArchive.session.answers[0]?.question).toEqual(question);
  });
});
