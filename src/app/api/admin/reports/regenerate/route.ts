import { NextRequest, NextResponse } from "next/server";
import { computeScores, generateNarrative } from "@/lib/score";
import { generateAiNarrative } from "@/lib/ai-report";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { archiveCurrentAttempt } from "@/lib/report-archive";
import { buildReportHtmlTemplate } from "@/lib/report-format";
import { participantReference } from "@/lib/report-privacy";
import { recordAuditLog } from "@/lib/audit-log";
import { serializeAnswerSnapshot } from "@/lib/assessment-session";
import { lockAssessmentSession } from "@/lib/assessment-session-lock";

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
  const answerSnapshot = serializeAnswerSnapshot(session.answers);
  const submittedAtSnapshot = session.submittedAt?.getTime() || null;

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
    participantReference: participantReference(session.user.id),
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

  const commit = await db.$transaction(async (tx) => {
    await lockAssessmentSession(tx, session.id);
    const currentSession = await tx.quizSession.findUnique({
      where: { id: session.id },
      select: {
        status: true,
        submittedAt: true,
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
    if (
      currentSession?.status !== "SUBMITTED" ||
      (currentSession.submittedAt?.getTime() || null) !== submittedAtSnapshot ||
      serializeAnswerSnapshot(currentSession.answers) !== answerSnapshot
    ) {
      return { kind: "ATTEMPT_CHANGED" as const };
    }

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
    await tx.assessmentReportShareToken.updateMany({
      where: { assessmentId, userId, revokedAt: null },
      data: { revokedAt: now },
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
        status: "DRAFT",
        availableAt: null,
        deliveryMethod: null,
      },
      update: {
        narrativeJson: JSON.stringify(narrative),
        status: "DRAFT",
        availableAt: null,
        deliveryMethod: null,
      },
    });
    await recordAuditLog(
      {
        tenantId: session.user.tenantId,
        actorId: check.liveUser.id,
        action: "REPORT_REGENERATED",
        metadata: {
          assessmentId,
          userId,
          archivedReportId: archivedEntry?.id || null,
          statusAfter: "DRAFT",
        },
      },
      tx,
    );

    return { kind: "UPDATED" as const, archivedEntry };
  });

  if (commit.kind === "ATTEMPT_CHANGED") {
    return NextResponse.json(
      {
        error:
          "The participant attempt changed while the report was being prepared. Regenerate the current submitted attempt again.",
        code: "ATTEMPT_CHANGED",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Report regenerated successfully.",
    assessmentId,
    userId,
    regeneratedAt: now.toISOString(),
    archivedReportId: commit.archivedEntry?.id || null,
  });
}
