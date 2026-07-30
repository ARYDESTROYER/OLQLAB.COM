import { Prisma } from "@prisma/client";

type AssessmentAttemptReader = Pick<
  Prisma.TransactionClient,
  "quizSession"
>;

export const ASSESSMENT_CONTENT_HISTORY_ERROR =
  "This assessment already has attempt history. Clone it before changing question content so historical responses remain interpretable.";

export function assessmentContentLockKey(assessmentId: string) {
  return `olq-assessment-content:${assessmentId}`;
}

/**
 * Serializes the first participant attempt with question-definition writes.
 * Every path that can change question evidence and the first-session creation
 * path must take this lock before checking or creating history.
 */
export async function lockAssessmentContent(
  tx: Prisma.TransactionClient,
  assessmentId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext(${assessmentContentLockKey(assessmentId)})
    ) IS NULL AS "lockResult"
  `);
}

export async function assessmentHasAttemptHistory(
  tx: AssessmentAttemptReader,
  assessmentId: string,
) {
  const attempt = await tx.quizSession.findFirst({
    where: { assessmentId },
    select: { id: true },
  });
  return Boolean(attempt);
}
