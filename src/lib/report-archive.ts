import { Prisma } from "@prisma/client";
import { isMissingTableError } from "@/lib/prisma-errors";

type ArchiveInput = {
  assessmentId: string;
  userId: string;
  archivedById?: string;
  reason?: string;
};

type TxClient = Prisma.TransactionClient;

export async function archiveCurrentAttempt(tx: TxClient, input: ArchiveInput) {
  const [session, score, report] = await Promise.all([
    tx.quizSession.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: input.assessmentId,
          userId: input.userId,
        },
      },
      select: {
        submittedAt: true,
      },
    }),
    tx.score.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: input.assessmentId,
          userId: input.userId,
        },
      },
      select: {
        openness: true,
        conscientiousness: true,
        extraversion: true,
        agreeableness: true,
        neuroticism: true,
        competencyJson: true,
        createdAt: true,
      },
    }),
    tx.report.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: input.assessmentId,
          userId: input.userId,
        },
      },
      select: {
        narrativeJson: true,
        createdAt: true,
      },
    }),
  ]);

  if (!session?.submittedAt && !score && !report) {
    return null;
  }

  let assessmentTitle: string | undefined;
  let participantName: string | undefined;
  if (report?.narrativeJson) {
    try {
      const parsed = JSON.parse(report.narrativeJson) as {
        assessmentTitle?: string;
        participantName?: string;
      };
      assessmentTitle = parsed.assessmentTitle;
      participantName = parsed.participantName;
    } catch {
      assessmentTitle = undefined;
      participantName = undefined;
    }
  }

  const scoreJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = score
    ? {
        openness: score.openness,
        conscientiousness: score.conscientiousness,
        extraversion: score.extraversion,
        agreeableness: score.agreeableness,
        neuroticism: score.neuroticism,
        competencyJson: score.competencyJson as Prisma.InputJsonValue,
        computedAt: score.createdAt.toISOString(),
      }
    : Prisma.DbNull;

  try {
    return await tx.reportArchive.create({
      data: {
        assessmentId: input.assessmentId,
        userId: input.userId,
        submittedAt: session?.submittedAt || null,
        archivedById: input.archivedById,
        archiveReason: input.reason,
        scoreJson,
        narrativeJson: report?.narrativeJson || null,
        assessmentTitle,
        participantName,
      },
    });
  } catch (error) {
    if (isMissingTableError(error, "reportarchive")) {
      return null;
    }
    throw error;
  }
}
