import { Prisma } from "@prisma/client";

type ShareTokenClient = Pick<
  Prisma.TransactionClient,
  "assessmentReportShareToken"
>;

export async function revokeAttemptShareTokens(
  client: ShareTokenClient,
  input: {
    assessmentId: string;
    userId: string;
    revokedAt?: Date;
  },
) {
  const result = await client.assessmentReportShareToken.updateMany({
    where: {
      assessmentId: input.assessmentId,
      userId: input.userId,
      revokedAt: null,
    },
    data: { revokedAt: input.revokedAt || new Date() },
  });
  return result.count;
}
