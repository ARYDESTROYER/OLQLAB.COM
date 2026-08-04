import { Prisma } from "@prisma/client";

export function questionImageMutationLockKey(questionId: string) {
  return `olq-question-image:${questionId}`;
}

/**
 * Serializes one question's Blob pointer mutations. Blob upload itself can happen
 * before this lock, but the in-lock re-read guarantees each successful replace or
 * remove observes and cleans up the exact asset it displaced.
 */
export async function lockQuestionImageMutation(
  tx: Prisma.TransactionClient,
  questionId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext(${questionImageMutationLockKey(questionId)})
    ) IS NULL AS "lockResult"
  `);
}
