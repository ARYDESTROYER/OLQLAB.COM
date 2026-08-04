import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import {
  type ParticipantAnswerInput,
  validateParticipantAnswer,
} from "@/lib/assessment-session";
import { lockAssessmentSession } from "@/lib/assessment-session-lock";
import { isSubmissionClaimLive } from "@/lib/assessment-submission-claim";

const questionSelect = {
  id: true,
  code: true,
  sectionId: true,
  prompt: true,
  imageUrl: true,
  imageAlt: true,
  imageCaption: true,
  questionType: true,
  scaleMin: true,
  scaleMax: true,
  options: { select: { id: true, text: true } },
} as const satisfies Prisma.QuestionSelect;

function answerJson(answer: ReturnType<typeof validatedAnswerValue>) {
  return answer;
}

function validatedAnswerValue(
  answer: Extract<ReturnType<typeof validateParticipantAnswer>, { ok: true }>['answer'],
) {
  if (answer.kind === "LIKERT_TRAIT") {
    return { questionId: answer.questionId, value: answer.value, optionId: null, textValue: null };
  }
  if (answer.kind === "SJT_SINGLE") {
    return { questionId: answer.questionId, value: null, optionId: answer.optionId, textValue: null };
  }
  return {
    questionId: answer.questionId,
    value: null,
    optionId: null,
    textValue: answer.textValue,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { id } = await params;

  let input: ParticipantAnswerInput;
  try {
    input = (await req.json()) as ParticipantAnswerInput;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof input.questionId !== "string" || !input.questionId) {
    return NextResponse.json({ error: "questionId is required." }, { status: 400 });
  }
  const questionId = input.questionId;

  if (id.startsWith("preview_")) {
    if (check.session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      await lockAssessmentSession(tx, id);
      const preview = await tx.assessmentPreviewSession.findUnique({ where: { id } });
      if (!preview || preview.adminId !== check.session.user.id) {
        return { status: 404 as const, error: "Not found" };
      }
      if (preview.expiresAt <= new Date()) {
        await tx.assessmentPreviewSession.delete({ where: { id: preview.id } });
        return {
          status: 410 as const,
          error: "This preview expired. Start a new preview from assessment settings.",
        };
      }
      if (preview.status === "SUBMITTED") {
        return { status: 409 as const, error: "This preview is already complete." };
      }

      const question = await tx.question.findFirst({
        where: { id: questionId, assessmentId: preview.assessmentId },
        select: questionSelect,
      });
      if (!question) return { status: 404 as const, error: "Question not found" };

      const validation = validateParticipantAnswer(question, input);
      if (!validation.ok) return { status: 422 as const, error: validation.error };

      const answers =
        preview.answersJson &&
        typeof preview.answersJson === "object" &&
        !Array.isArray(preview.answersJson)
          ? { ...(preview.answersJson as Record<string, Prisma.JsonValue>) }
          : {};

      if (validation.answer.kind === "FREE_TEXT" && validation.answer.clear) {
        delete answers[question.id];
      } else {
        answers[question.id] = answerJson(validatedAnswerValue(validation.answer));
      }

      await tx.assessmentPreviewSession.update({
        where: { id: preview.id },
        data: { answersJson: answers as Prisma.InputJsonObject },
      });
      return {
        status: 200 as const,
        body:
          validation.answer.kind === "FREE_TEXT" && validation.answer.clear
            ? { questionId: question.id, cleared: true }
            : validatedAnswerValue(validation.answer),
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.body);
  }

  const session = await db.quizSession.findUnique({ where: { id } });
  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (session.status === "SUBMITTED") {
    return NextResponse.json(
      { error: "Session already submitted and is read-only." },
      { status: 409 },
    );
  }
  if (
    isSubmissionClaimLive({
      claimId: session.submissionClaimId,
      claimedAt: session.submissionClaimedAt,
    })
  ) {
    return NextResponse.json(
      {
        error: "Your completed answers are being prepared for submission. Wait a moment before editing.",
        code: "SUBMISSION_IN_PROGRESS",
      },
      { status: 409 },
    );
  }

  const access = await resolveAssessmentAccess(session.userId, session.assessmentId);
  if (!access.canStartAssessment) {
    return NextResponse.json(
      { error: "Your access to this assessment is no longer active." },
      { status: 403 },
    );
  }

  const question = await db.question.findFirst({
    where: { id: questionId, assessmentId: session.assessmentId },
    select: questionSelect,
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const validation = validateParticipantAnswer(question, input);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const result = await db.$transaction(async (tx) => {
    await lockAssessmentSession(tx, id);
    const current = await tx.quizSession.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
        submissionClaimId: true,
        submissionClaimedAt: true,
      },
    });
    if (!current || current.userId !== check.liveUser.id) {
      return { status: 404 as const, error: "Not found" };
    }
    if (current.status !== "IN_PROGRESS") {
      return {
        status: 409 as const,
        error: "Session already submitted and is read-only.",
      };
    }
    if (
      isSubmissionClaimLive({
        claimId: current.submissionClaimId,
        claimedAt: current.submissionClaimedAt,
      })
    ) {
      return {
        status: 409 as const,
        error: "Your completed answers are being prepared for submission. Wait a moment before editing.",
        code: "SUBMISSION_IN_PROGRESS" as const,
      };
    }
    if (current.submissionClaimId) {
      await tx.quizSession.update({
        where: { id },
        data: {
          submissionClaimId: null,
          submissionClaimedAt: null,
          submissionAnswerSnapshotHash: null,
        },
      });
    }

    if (validation.answer.kind === "FREE_TEXT" && validation.answer.clear) {
      await tx.answer.deleteMany({
        where: { sessionId: id, questionId: question.id },
      });
      return {
        status: 200 as const,
        body: { questionId: question.id, cleared: true },
      };
    }

    const value = validatedAnswerValue(validation.answer);
    const saved = await tx.answer.upsert({
      where: { sessionId_questionId: { sessionId: id, questionId: question.id } },
      create: { sessionId: id, ...value },
      update: {
        value: value.value,
        optionId: value.optionId,
        textValue: value.textValue,
      },
      select: {
        questionId: true,
        value: true,
        optionId: true,
        textValue: true,
      },
    });
    return { status: 200 as const, body: saved };
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json(result.body);
}
