import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { id } = await params;

  const { questionId, value, optionId } = (await req.json()) as {
    questionId: string;
    value?: number;
    optionId?: string;
  };

  if (!questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  const session = await db.quizSession.findUnique({ where: { id } });
  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { options: true },
  });

  if (!question || question.assessmentId !== session.assessmentId) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  if (question.questionType === "LIKERT_TRAIT") {
    if (typeof value !== "number") {
      return NextResponse.json(
        { error: "Likert question requires numeric value" },
        { status: 400 },
      );
    }

    const answer = await db.answer.upsert({
      where: { sessionId_questionId: { sessionId: id, questionId } },
      create: { sessionId: id, questionId, value, optionId: null },
      update: { value, optionId: null },
    });

    return NextResponse.json(answer);
  }

  if (!optionId) {
    return NextResponse.json(
      { error: "Scenario question requires optionId" },
      { status: 400 },
    );
  }

  const option = question.options.find((item) => item.id === optionId);
  if (!option) {
    return NextResponse.json({ error: "Option not found" }, { status: 404 });
  }

  const answer = await db.answer.upsert({
    where: { sessionId_questionId: { sessionId: id, questionId } },
    create: { sessionId: id, questionId, optionId: option.id, value: null },
    update: { optionId: option.id, value: null },
  });

  return NextResponse.json(answer);
}
