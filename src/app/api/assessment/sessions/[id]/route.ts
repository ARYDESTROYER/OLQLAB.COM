import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { toParticipantQuestionDto } from "@/lib/assessment-session";

type QuestionRow = {
  id: string;
  sectionId: string | null;
  sortOrder: number;
};

function seededShuffle<T extends QuestionRow>(items: T[], seed: string) {
  const out = [...items];
  let state = Number.parseInt(
    createHash("sha256").update(seed).digest("hex").slice(0, 8),
    16,
  );

  for (let i = out.length - 1; i > 0; i -= 1) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    const rand = Math.abs(state) % (i + 1);
    const swapIndex = Number.isFinite(rand) ? rand : 0;
    [out[i], out[swapIndex]] = [out[swapIndex], out[i]];
  }

  return out;
}

function previewAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value).filter(
    (answer): answer is Record<string, unknown> =>
      Boolean(answer) && typeof answer === "object" && !Array.isArray(answer),
  );
}

const assessmentSelect = {
  id: true,
  title: true,
  policy: {
    select: {
      questionPresentationMode: true,
      randomizeQuestionOrder: true,
    },
  },
  sections: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      sortOrder: true,
    },
  },
  questions: {
    orderBy: { sortOrder: "asc" as const },
    select: {
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
      sortOrder: true,
      options: {
        orderBy: { displayOrder: "asc" as const },
        select: { id: true, text: true },
      },
    },
  },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { id } = await params;

  if (id.startsWith("preview_")) {
    if (check.session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const preview = await db.assessmentPreviewSession.findUnique({
      where: { id },
      include: { assessment: { select: assessmentSelect } },
    });
    if (!preview || preview.adminId !== check.session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (preview.expiresAt <= new Date()) {
      await db.assessmentPreviewSession.delete({ where: { id: preview.id } });
      return NextResponse.json(
        { error: "This preview expired. Start a new preview from assessment settings." },
        { status: 410 },
      );
    }

    const shouldRandomize = Boolean(preview.assessment.policy?.randomizeQuestionOrder);
    const orderedQuestions = shouldRandomize
      ? seededShuffle(preview.assessment.questions, preview.id)
      : preview.assessment.questions;

    return NextResponse.json({
      sessionId: preview.id,
      assessmentId: preview.assessmentId,
      assessmentTitle: preview.assessment.title,
      previewMode: true,
      randomized: shouldRandomize,
      questionPresentationMode:
        preview.assessment.policy?.questionPresentationMode || "ALL_AT_ONCE",
      sections: shouldRandomize ? [] : preview.assessment.sections,
      questions: orderedQuestions.map(toParticipantQuestionDto),
      answers: previewAnswers(preview.answersJson),
      status: preview.status,
    });
  }

  const session = await db.quizSession.findUnique({
    where: { id },
    include: {
      assessment: { select: assessmentSelect },
      answers: {
        select: {
          questionId: true,
          value: true,
          optionId: true,
          textValue: true,
        },
      },
    },
  });

  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await resolveAssessmentAccess(session.userId, session.assessmentId);
  const mayRead =
    session.status === "IN_PROGRESS" ? access.canStartAssessment : access.canViewAppReport;
  if (!mayRead) {
    return NextResponse.json(
      { error: "Your access to this assessment is no longer active." },
      { status: 403 },
    );
  }

  const shouldRandomize = Boolean(session.assessment.policy?.randomizeQuestionOrder);
  const orderedQuestions = shouldRandomize
    ? seededShuffle(session.assessment.questions, session.id)
    : session.assessment.questions;

  return NextResponse.json({
    sessionId: session.id,
    assessmentId: session.assessmentId,
    assessmentTitle: session.assessment.title,
    previewMode: false,
    randomized: shouldRandomize,
    questionPresentationMode:
      session.assessment.policy?.questionPresentationMode || "ALL_AT_ONCE",
    sections: shouldRandomize ? [] : session.assessment.sections,
    questions: orderedQuestions.map(toParticipantQuestionDto),
    answers: session.answers,
    status: session.status,
  });
}
