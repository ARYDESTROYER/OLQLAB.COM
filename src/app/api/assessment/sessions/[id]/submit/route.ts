import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { computeScores, generateNarrative } from "@/lib/score";
import { generateAiNarrative } from "@/lib/ai-report";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { buildReportHtmlTemplate } from "@/lib/report-format";
import { sendManualSubmissionAlertEmails } from "@/lib/report-delivery";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { id } = await params;

  let requestedPreviewMode = false;
  try {
    const rawBody = await req.text();
    if (rawBody) {
      const parsed = JSON.parse(rawBody) as { previewMode?: boolean };
      requestedPreviewMode = parsed.previewMode === true;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

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
                      assessmentCompetency: true,
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

  const isAdminPreview = requestedPreviewMode && check.session.user.role === "ADMIN";
  const previewRedirectTo = `/admin/assessments/${session.assessmentId}`;

  if (session.status === "SUBMITTED") {
    return NextResponse.json({
      submitted: true,
      alreadySubmitted: true,
      previewMode: isAdminPreview,
      redirectTo: isAdminPreview ? previewRedirectTo : undefined,
      postSubmitMessage:
        isAdminPreview
          ? "Preview already submitted. No participant report was generated."
          : session.assessment.policy?.postSubmitMessage ||
            "Thanks for completing your assessment.",
    });
  }

  const answersByQuestion = new Map(
    session.answers.map((answer) => [answer.questionId, answer]),
  );

  for (const question of session.assessment.questions) {
    const answer = answersByQuestion.get(question.id);
    const promptPreview = (question.prompt || "Question").slice(0, 60);

    if (question.questionType === "LIKERT_TRAIT") {
      if (!answer || typeof answer.value !== "number") {
        return NextResponse.json(
          { error: `Please answer all questions before submitting. Missing: ${promptPreview}` },
          { status: 400 },
        );
      }
      continue;
    }

    if (question.questionType === "SJT_SINGLE") {
      if (!answer || !answer.optionId) {
        return NextResponse.json(
          { error: `Please answer all questions before submitting. Missing: ${promptPreview}` },
          { status: 400 },
        );
      }
      continue;
    }

    if (!answer || !answer.textValue?.trim()) {
      return NextResponse.json(
        { error: `Please answer all questions before submitting. Missing: ${promptPreview}` },
        { status: 400 },
      );
    }
  }

  const submittedAt = new Date();
  const reportWorkflow = session.assessment.policy?.reportWorkflow || "AI_STANDARD";

  if (isAdminPreview) {
    await db.quizSession.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt },
    });

    return NextResponse.json({
      submitted: true,
      previewMode: true,
      redirectTo: previewRedirectTo,
      postSubmitMessage:
        "Preview completed. No participant score or report was generated.",
    });
  }

  if (reportWorkflow === "MANUAL_PDF_UPLOAD") {
    const participantName =
      `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant";
    const narrative = {
      assessmentTakenAt: submittedAt.toISOString(),
      assessmentTitle: session.assessment.title,
      participantName,
      reportVersion: "manual_pdf_v1",
      reportWorkflow,
      note: "Manual report workflow enabled. Admin will upload and publish the PDF report.",
    };

    await db.$transaction([
      db.quizSession.update({
        where: { id },
        data: { status: "SUBMITTED", submittedAt },
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
      }),
    ]);

    try {
      await sendManualSubmissionAlertEmails({
        assessmentId: session.assessmentId,
        userId: session.userId,
        startedAt: session.startedAt,
        submittedAt,
      });
    } catch (error) {
      console.error("Failed to send manual submission alerts:", error);
    }

    return NextResponse.json({
      submitted: true,
      postSubmitMessage:
        session.assessment.policy?.postSubmitMessage ||
        "Assessment completed. You will be notified once your report is available.",
    });
  }

  const { traits, competencies } = computeScores(
    session.assessment.questions,
    session.answers,
  );
  const baseNarrative = generateNarrative(traits, competencies);
  const cprScores = {
    composite: Math.round((traits.conscientiousness + traits.openness) / 2),
    pattern: Math.round((traits.openness + traits.extraversion) / 2),
    recognition: Math.round((traits.agreeableness + (100 - traits.neuroticism)) / 2),
  };
  const aiNarrative = await generateAiNarrative(traits, competencies, {
    fullName: `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant",
    email: session.user.email,
    assessmentTitle: session.assessment.title,
  });
  const narrative = {
    ...baseNarrative,
    assessmentTakenAt: submittedAt.toISOString(),
    assessmentTitle: session.assessment.title,
    participantName: `${session.user.firstName} ${session.user.lastName}`.trim(),
    cprScores,
    aiNarrative,
    adminEditedHtml: buildReportHtmlTemplate(
      {
        ...baseNarrative,
        assessmentTakenAt: submittedAt.toISOString(),
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

  const access = await resolveAssessmentAccess(session.userId, session.assessmentId);
  const status = access.enrollmentReportMode === "MANUAL" ? "DRAFT" : "PUBLISHED";
  const availableAt =
    access.enrollmentReportMode === "AUTO" && access.enrollmentReportDelayHours > 0
      ? new Date(submittedAt.getTime() + access.enrollmentReportDelayHours * 60 * 60 * 1000)
      : submittedAt;

  await db.$transaction([
    db.quizSession.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt },
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
        status,
        availableAt,
      },
      update: {
        narrativeJson: JSON.stringify(narrative),
        status,
        availableAt,
      },
    }),
  ]);

  return NextResponse.json({
    submitted: true,
    postSubmitMessage:
      session.assessment.policy?.postSubmitMessage ||
      "Thanks for completing your assessment.",
  });
}
