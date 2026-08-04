import { describe, expect, it, vi } from "vitest";
import {
  clearAssessmentSubmissionClaim,
  decideSubmissionClaim,
  hashSubmissionAnswerSnapshot,
  isSubmissionClaimLive,
  verifyAssessmentSubmissionClaim,
} from "@/lib/assessment-submission-claim";

const now = new Date("2026-07-30T12:00:00.000Z");

describe("assessment submission claim lease", () => {
  it("rejects a parallel claimant while the first claim is live", () => {
    const state = {
      userId: "user-1",
      status: "IN_PROGRESS" as const,
      submissionClaimId: "claim-1",
      submissionClaimedAt: new Date("2026-07-30T11:59:00.000Z"),
    };

    expect(
      decideSubmissionClaim({ state, userId: "user-1", claimId: "claim-2", now }),
    ).toMatchObject({ kind: "IN_PROGRESS" });
    expect(
      decideSubmissionClaim({ state, userId: "user-1", claimId: "claim-1", now }),
    ).toEqual({ kind: "CLAIMABLE" });
  });

  it("allows deterministic takeover after the claim lease is stale", () => {
    const state = {
      userId: "user-1",
      status: "IN_PROGRESS" as const,
      submissionClaimId: "abandoned-claim",
      submissionClaimedAt: new Date("2026-07-30T11:54:59.999Z"),
    };

    expect(isSubmissionClaimLive({
      claimId: state.submissionClaimId,
      claimedAt: state.submissionClaimedAt,
      now,
    })).toBe(false);
    expect(
      decideSubmissionClaim({ state, userId: "user-1", claimId: "claim-2", now }),
    ).toEqual({ kind: "CLAIMABLE" });
  });

  it("binds claims to exact answer bytes and clears only the owning claim", async () => {
    expect(hashSubmissionAnswerSnapshot("snapshot-a")).not.toBe(
      hashSubmissionAnswerSnapshot("snapshot-b"),
    );
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });

    await expect(
      clearAssessmentSubmissionClaim(
        { quizSession: { updateMany } } as never,
        { sessionId: "session-1", claimId: "claim-1" },
      ),
    ).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", submissionClaimId: "claim-1" },
      data: {
        submissionClaimId: null,
        submissionClaimedAt: null,
        submissionAnswerSnapshotHash: null,
      },
    });
  });

  it("verifies the exact claim and snapshot again at commit", async () => {
    const answerSnapshot = JSON.stringify([
      { questionId: "q1", value: 4, optionId: null, textValue: null },
    ]);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      quizSession: {
        findUnique: vi.fn().mockResolvedValue({
          userId: "user-1",
          status: "IN_PROGRESS",
          submissionClaimId: "claim-1",
          submissionAnswerSnapshotHash:
            hashSubmissionAnswerSnapshot(answerSnapshot),
          answers: [
            { questionId: "q1", value: 4, optionId: null, textValue: null },
          ],
        }),
        updateMany,
      },
    };

    await expect(
      verifyAssessmentSubmissionClaim(tx as never, {
        sessionId: "session-1",
        userId: "user-1",
        claimId: "claim-1",
        answerSnapshot,
        answerSnapshotHash: hashSubmissionAnswerSnapshot(answerSnapshot),
      }),
    ).resolves.toBe("VERIFIED");
    expect(updateMany).not.toHaveBeenCalled();

    tx.quizSession.findUnique.mockResolvedValue({
      userId: "user-1",
      status: "IN_PROGRESS",
      submissionClaimId: "claim-1",
      submissionAnswerSnapshotHash: hashSubmissionAnswerSnapshot(answerSnapshot),
      answers: [
        { questionId: "q1", value: 5, optionId: null, textValue: null },
      ],
    });
    await expect(
      verifyAssessmentSubmissionClaim(tx as never, {
        sessionId: "session-1",
        userId: "user-1",
        claimId: "claim-1",
        answerSnapshot,
        answerSnapshotHash: hashSubmissionAnswerSnapshot(answerSnapshot),
      }),
    ).resolves.toBe("ANSWERS_CHANGED");
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1", submissionClaimId: "claim-1" },
      }),
    );
  });
});
