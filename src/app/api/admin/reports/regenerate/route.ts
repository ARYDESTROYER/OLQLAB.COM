import { NextRequest, NextResponse } from "next/server";
import { computeScores, generateNarrative } from "@/lib/score";
import { generateAiNarrative } from "@/lib/ai-report";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { archiveCurrentAttempt } from "@/lib/report-archive";
import { buildReportHtmlTemplate } from "@/lib/report-format";

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = (await req.json().catch(() => null)) as
    | { assessmentId?: string; userId?: string }
    | null;

  const assessmentId = body?.assessmentId?.trim();
  const userId = body?.userId?.trim();

  if (!assessmentId || !userId) {
    return NextResponse.json(
      { error: "assessmentId and userId are required." },
      { status: 400 },
    );
  }

  const session = await db.quizSession.findUnique({
    where: {
      assessmentId_userId: {
        assessmentId,
        userId,
      },
    },
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
                      assessmentCompetency: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      answers: true,
      user: true,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Assessment session not found." }, { status: 404 });
  }

  if (session.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "Only submitted assessments can be regenerated." },
      { status: 400 },
    );
  }

  const { traits, competencies } = computeScores(
    session.assessment.questions,
    session.answers,
  );

  const cprScores = {
    composite: Math.round((traits.conscientiousness + traits.openness) / 2),
    pattern: Math.round((traits.openness + traits.extraversion) / 2),
    recognition: Math.round((traits.agreeableness + (100 - traits.neuroticism)) / 2),
  };

  const baseNarrative = generateNarrative(traits, competencies);
  const aiNarrative = await generateAiNarrative(traits, competencies, {
    fullName: `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant",
    email: session.user.email,
    assessmentTitle: session.assessment.title,
  });

  const now = new Date();
  const narrative = {
    ...baseNarrative,
    assessmentTakenAt: session.submittedAt?.toISOString() || now.toISOString(),
    assessmentTitle: session.assessment.title,
    participantName: `${session.user.firstName} ${session.user.lastName}`.trim(),
    cprScores,
    regeneratedAt: now.toISOString(),
    regeneratedByAdminId: check.session.user.id,
    aiNarrative,
    adminEditedHtml: buildReportHtmlTemplate(
      {
        ...baseNarrative,
        assessmentTakenAt: session.submittedAt?.toISOString() || now.toISOString(),
        assessmentTitle: session.assessment.title,
        participantName: `${session.user.firstName} ${session.user.lastName}`.trim(),
        cprScores,
        aiNarrative,
      },
      {
        assessmentTitle: session.assessment.title,
        participantName: `${session.user.firstName} ${session.user.lastName}`.trim(),
      },
    ),
  };

  const archived = await db.$transaction(async (tx) => {
    const archivedEntry = await archiveCurrentAttempt(tx, {
      assessmentId,
      userId,
      archivedById: check.session.user.id,
      reason: "admin_regenerate_report",
    });

    await tx.score.upsert({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
      create: {
        assessmentId,
        userId,
        ...traits,
        competencyJson: competencies,
      },
      update: {
        ...traits,
        competencyJson: competencies,
      },
    });
    await tx.report.upsert({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
      create: {
        assessmentId,
        userId,
        narrativeJson: JSON.stringify(narrative),
      },
      update: {
        narrativeJson: JSON.stringify(narrative),
      },
    });

    return archivedEntry;
  });

  return NextResponse.json({
    ok: true,
    message: "Report regenerated successfully.",
    assessmentId,
    userId,
    regeneratedAt: now.toISOString(),
    archivedReportId: archived?.id || null,
  });
}
