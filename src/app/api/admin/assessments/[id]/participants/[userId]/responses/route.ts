import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

function computeDurationMs(startedAt: Date | null, submittedAt: Date | null) {
  if (!startedAt || !submittedAt) return null;
  const diff = submittedAt.getTime() - startedAt.getTime();
  return diff > 0 ? diff : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId, userId } = await params;

  const [assessment, participant, session, report, questions] = await Promise.all([
    db.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        title: true,
      },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
    db.quizSession.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
      include: {
        answers: true,
      },
    }),
    db.report.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
      include: {
        pdfAsset: {
          select: {
            id: true,
            fileName: true,
            sizeBytes: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.question.findMany({
      where: { assessmentId },
      orderBy: { sortOrder: "asc" },
      include: {
        section: {
          select: {
            id: true,
            title: true,
          },
        },
        options: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            code: true,
            text: true,
            displayOrder: true,
          },
        },
      },
    }),
  ]);

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  if (!session) {
    return NextResponse.json({ error: "No session found for this participant." }, { status: 404 });
  }

  const answerByQuestionId = new Map(
    session.answers.map((answer) => [answer.questionId, answer]),
  );

  const responses = questions.map((question) => {
    const answer = answerByQuestionId.get(question.id);
    const selectedOption = answer?.optionId
      ? question.options.find((option) => option.id === answer.optionId) || null
      : null;

    return {
      id: question.id,
      code: question.code,
      prompt: question.prompt,
      questionType: question.questionType,
      section: question.section,
      options: question.options,
      answer: {
        value: answer?.value ?? null,
        optionId: answer?.optionId ?? null,
        optionCode: selectedOption?.code ?? null,
        optionText: selectedOption?.text ?? null,
        textValue: answer?.textValue ?? null,
      },
    };
  });

  return NextResponse.json({
    assessment,
    participant,
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt,
      durationMs: computeDurationMs(session.startedAt, session.submittedAt),
    },
    report: report
      ? {
          id: report.id,
          status: report.status,
          availableAt: report.availableAt,
          deliveryMethod: report.deliveryMethod,
          hasManualPdf: Boolean(report.pdfAsset),
          manualPdf: report.pdfAsset
            ? {
                fileName: report.pdfAsset.fileName,
                sizeBytes: report.pdfAsset.sizeBytes,
                updatedAt: report.pdfAsset.updatedAt,
              }
            : null,
        }
      : null,
    responses,
  });
}
