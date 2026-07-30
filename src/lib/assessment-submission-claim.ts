import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { serializeAnswerSnapshot } from "@/lib/assessment-session";
import { lockAssessmentSession } from "@/lib/assessment-session-lock";

export const SUBMISSION_CLAIM_LEASE_MS = 5 * 60 * 1_000;

type ClaimState = {
  userId: string;
  status: "IN_PROGRESS" | "SUBMITTED";
  submissionClaimId: string | null;
  submissionClaimedAt: Date | null;
};

const answerSelect = {
  questionId: true,
  value: true,
  optionId: true,
  textValue: true,
} as const;

export function hashSubmissionAnswerSnapshot(snapshot: string) {
  return createHash("sha256").update(snapshot).digest("hex");
}

export function isSubmissionClaimLive(input: {
  claimId: string | null;
  claimedAt: Date | null;
  now?: Date;
  leaseMs?: number;
}) {
  if (!input.claimId || !input.claimedAt) return false;
  const now = input.now || new Date();
  const leaseMs = input.leaseMs ?? SUBMISSION_CLAIM_LEASE_MS;
  return input.claimedAt.getTime() > now.getTime() - leaseMs;
}

export function decideSubmissionClaim(input: {
  state: ClaimState | null;
  userId: string;
  claimId: string;
  now: Date;
  leaseMs?: number;
}) {
  if (!input.state || input.state.userId !== input.userId) {
    return { kind: "NOT_FOUND" as const };
  }
  if (input.state.status !== "IN_PROGRESS") {
    return { kind: "ALREADY_SUBMITTED" as const };
  }
  if (
    input.state.submissionClaimId !== input.claimId &&
    isSubmissionClaimLive({
      claimId: input.state.submissionClaimId,
      claimedAt: input.state.submissionClaimedAt,
      now: input.now,
      leaseMs: input.leaseMs,
    })
  ) {
    const expiresAt = new Date(
      input.state.submissionClaimedAt!.getTime() +
        (input.leaseMs ?? SUBMISSION_CLAIM_LEASE_MS),
    );
    return {
      kind: "IN_PROGRESS" as const,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((expiresAt.getTime() - input.now.getTime()) / 1_000),
      ),
    };
  }
  return { kind: "CLAIMABLE" as const };
}

export async function acquireAssessmentSubmissionClaim(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    userId: string;
    claimId: string;
    answerSnapshot: string;
    now: Date;
  },
) {
  await lockAssessmentSession(tx, input.sessionId);
  const current = await tx.quizSession.findUnique({
    where: { id: input.sessionId },
    select: {
      userId: true,
      status: true,
      submissionClaimId: true,
      submissionClaimedAt: true,
      answers: { select: answerSelect },
    },
  });
  const decision = decideSubmissionClaim({
    state: current,
    userId: input.userId,
    claimId: input.claimId,
    now: input.now,
  });
  if (decision.kind !== "CLAIMABLE") return decision;
  if (!current || serializeAnswerSnapshot(current.answers) !== input.answerSnapshot) {
    return { kind: "ANSWERS_CHANGED" as const };
  }

  const answerSnapshotHash = hashSubmissionAnswerSnapshot(input.answerSnapshot);
  await tx.quizSession.update({
    where: { id: input.sessionId },
    data: {
      submissionClaimId: input.claimId,
      submissionClaimedAt: input.now,
      submissionAnswerSnapshotHash: answerSnapshotHash,
    },
  });
  return { kind: "CLAIMED" as const, answerSnapshotHash };
}

type ClaimMutationClient = Pick<
  Prisma.TransactionClient,
  "quizSession"
>;

export async function clearAssessmentSubmissionClaim(
  client: ClaimMutationClient,
  input: { sessionId: string; claimId: string },
) {
  const cleared = await client.quizSession.updateMany({
    where: { id: input.sessionId, submissionClaimId: input.claimId },
    data: {
      submissionClaimId: null,
      submissionClaimedAt: null,
      submissionAnswerSnapshotHash: null,
    },
  });
  return cleared.count === 1;
}

export async function verifyAssessmentSubmissionClaim(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    userId: string;
    claimId: string;
    answerSnapshot: string;
    answerSnapshotHash: string;
  },
) {
  await lockAssessmentSession(tx, input.sessionId);
  const current = await tx.quizSession.findUnique({
    where: { id: input.sessionId },
    select: {
      userId: true,
      status: true,
      submissionClaimId: true,
      submissionAnswerSnapshotHash: true,
      answers: { select: answerSelect },
    },
  });
  if (!current || current.userId !== input.userId) return "NOT_FOUND" as const;
  if (current.status !== "IN_PROGRESS") return "ALREADY_SUBMITTED" as const;
  if (
    current.submissionClaimId !== input.claimId ||
    current.submissionAnswerSnapshotHash !== input.answerSnapshotHash
  ) {
    return "CLAIM_LOST" as const;
  }
  if (serializeAnswerSnapshot(current.answers) !== input.answerSnapshot) {
    await clearAssessmentSubmissionClaim(tx, {
      sessionId: input.sessionId,
      claimId: input.claimId,
    });
    return "ANSWERS_CHANGED" as const;
  }
  return "VERIFIED" as const;
}
