import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { computeScores, generateNarrative } from "@/lib/score";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { id } = await params;

  const session = await db.quizSession.findUnique({
    where: { id },
    include: {
      assessment: {
        include: {
          questions: true,
          policy: true,
        },
      },
      answers: true,
    },
  });

  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const answerMap: Record<string, number> = {};
  for (const answer of session.answers) answerMap[answer.questionId] = answer.value;

  const scores = computeScores(session.assessment.questions, answerMap);
  const narrative = generateNarrative(scores);

  await db.$transaction([
    db.quizSession.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    }),
    db.score.upsert({
      where: {
        assessmentId_userId: {
          assessmentId: session.assessmentId,
          userId: session.userId,
        },
      },
      create: {
        assessmentId: session.assessmentId,
        userId: session.userId,
        ...scores,
      },
      update: scores,
    }),
    db.report.upsert({
      where: {
        assessmentId_userId: {
          assessmentId: session.assessmentId,
          userId: session.userId,
        },
      },
      create: {
        assessmentId: session.assessmentId,
        userId: session.userId,
        narrativeJson: JSON.stringify(narrative),
      },
      update: { narrativeJson: JSON.stringify(narrative) },
    }),
  ]);

  return NextResponse.json({
    submitted: true,
    postSubmitMessage:
      session.assessment.policy?.postSubmitMessage ||
      "Thanks for completing your assessment.",
  });
}
