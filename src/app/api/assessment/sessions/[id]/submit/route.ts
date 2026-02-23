import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { computeScores, generateNarrative } from "@/lib/score";
import { generateAiNarrative } from "@/lib/ai-report";

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
          questions: {
            include: {
              options: {
                include: {
                  impacts: {
                    include: {
                      competency: true,
                    },
                  },
                },
              },
            },
          },
          policy: true,
        },
      },
      answers: true,
      user: true,
    },
  });

  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.status === "SUBMITTED") {
    return NextResponse.json({
      submitted: true,
      alreadySubmitted: true,
      postSubmitMessage:
        session.assessment.policy?.postSubmitMessage ||
        "Thanks for completing your assessment.",
    });
  }

  const { traits, competencies } = computeScores(
    session.assessment.questions,
    session.answers,
  );
  const baseNarrative = generateNarrative(traits, competencies);
  const aiNarrative = await generateAiNarrative(traits, competencies, {
    fullName: `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant",
    email: session.user.email,
    assessmentTitle: session.assessment.title,
  });
  const narrative = {
    ...baseNarrative,
    aiNarrative,
  };

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
        ...traits,
        competencyJson: competencies,
      },
      update: {
        ...traits,
        competencyJson: competencies,
      },
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
