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
        id: true,
        startedAt: true,
        submittedAt: true,
        user: {
          select: { firstName: true, lastName: true },
        },
        assessment: {
          select: { title: true },
        },
        answers: {
          orderBy: { createdAt: "asc" },
          select: {
            value: true,
            textValue: true,
            optionId: true,
            createdAt: true,
            updatedAt: true,
            question: {
              select: {
                id: true,
                assessmentId: true,
                sectionId: true,
                code: true,
                prompt: true,
                imageUrl: true,
                imageAlt: true,
                imageCaption: true,
                questionType: true,
                category: true,
                trait: true,
                reverse: true,
                scaleMin: true,
                scaleMax: true,
                sortOrder: true,
              },
            },
            option: {
              select: { id: true, code: true, text: true },
            },
          },
        },
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
        status: true,
        publicationGeneration: true,
        availableAt: true,
        deliveryMethod: true,
        createdAt: true,
        updatedAt: true,
        pdfAsset: {
          select: {
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            pdfBytes: true,
            uploadedByAdminId: true,
            uploadedAt: true,
            updatedAt: true,
          },
        },
      },
    }),
  ]);

  if (!session && !score && !report) {
    return null;
  }

  let assessmentTitle: string | undefined;
  let participantName: string | undefined;
  let parsedNarrative: Record<string, unknown> = {};
  if (report?.narrativeJson) {
    try {
      const parsed = JSON.parse(report.narrativeJson) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedNarrative = parsed as Record<string, unknown>;
        assessmentTitle =
          typeof parsedNarrative.assessmentTitle === "string"
            ? parsedNarrative.assessmentTitle
            : undefined;
        participantName =
          typeof parsedNarrative.participantName === "string"
            ? parsedNarrative.participantName
            : undefined;
      } else {
        parsedNarrative = { legacyNarrativeValue: parsed };
      }
    } catch {
      parsedNarrative = { legacyNarrativeJson: report.narrativeJson };
    }
  }

  assessmentTitle = assessmentTitle || session?.assessment.title;
  participantName =
    participantName ||
    (session
      ? `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant"
      : undefined);

  const archivedNarrative = {
    ...parsedNarrative,
    _olqArchive: {
      version: 3,
      session: session
        ? {
            id: session.id,
            startedAt: session.startedAt.toISOString(),
            submittedAt: session.submittedAt?.toISOString() || null,
            answers: session.answers.map((answer) => ({
              question: answer.question,
              value: answer.value,
              textValue: answer.textValue,
              optionId: answer.optionId,
              selectedOption: answer.option,
              createdAt: answer.createdAt.toISOString(),
              updatedAt: answer.updatedAt.toISOString(),
            })),
          }
        : null,
      report: report
        ? {
            status: report.status,
            publicationGeneration: report.publicationGeneration,
            availableAt: report.availableAt?.toISOString() || null,
            deliveryMethod: report.deliveryMethod,
            createdAt: report.createdAt.toISOString(),
            updatedAt: report.updatedAt.toISOString(),
          }
        : null,
      pdfAsset: report?.pdfAsset
        ? {
            fileName: report.pdfAsset.fileName,
            mimeType: report.pdfAsset.mimeType,
            sizeBytes: report.pdfAsset.sizeBytes,
            pdfBase64: Buffer.from(report.pdfAsset.pdfBytes).toString("base64"),
            uploadedByAdminId: report.pdfAsset.uploadedByAdminId,
            uploadedAt: report.pdfAsset.uploadedAt.toISOString(),
            updatedAt: report.pdfAsset.updatedAt.toISOString(),
          }
        : null,
    },
  };

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
        narrativeJson: JSON.stringify(archivedNarrative),
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
