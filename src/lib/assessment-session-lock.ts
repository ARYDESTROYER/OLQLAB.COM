import { Prisma } from "@prisma/client";

/**
 * Serializes answer mutations and submission commits for one assessment
 * session without holding a database transaction during report generation.
 */
export async function lockAssessmentSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext(${`olq-assessment-session:${sessionId}`})
    ) IS NULL AS "lockResult"
  `);
}
