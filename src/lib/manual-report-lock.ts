import { Prisma } from "@prisma/client";

export function manualReportMutationLockKey(reportId: string) {
  return `olq-manual-report:${reportId}`;
}

/**
 * Serializes mutations that replace, publish, or remove one manual PDF report.
 * The lock is released automatically when the surrounding transaction ends.
 */
export async function lockManualReportMutation(
  tx: Prisma.TransactionClient,
  reportId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext(${manualReportMutationLockKey(reportId)})
    ) IS NULL AS "lockResult"
  `);
}
