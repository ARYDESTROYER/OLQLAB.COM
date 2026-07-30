import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { computeScores, generateNarrative } from "@/lib/score";
import { generateAiNarrative } from "@/lib/ai-report";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { buildReportHtmlTemplate } from "@/lib/report-format";
import { canonicalizeReportNarrative } from "@/lib/report-content";
import {
  serializeAnswerSnapshot,
  validateParticipantAnswer,
} from "@/lib/assessment-session";
import { lockAssessmentSession } from "@/lib/assessment-session-lock";
import { sendManualSubmissionAlertEmails } from "@/lib/report-delivery";
import { recordAuditLog } from "@/lib/audit-log";
import { participantReference } from "@/lib/report-privacy";
import {
  acquireAssessmentSubmissionClaim,
  clearAssessmentSubmissionClaim,
  verifyAssessmentSubmissionClaim,
} from "@/lib/assessment-submission-claim";

type StoredAnswer = {
  questionId: string;
  value?: number | null;
  optionId?: string | null;
  textValue?: string | null;
};

function validateCompleteness(
  questions: Array<{
    id: string;
    code: string | null;
    sectionId: string | null;
    prompt: string;
    imageUrl: string | null;
    imageAlt: string | null;
    imageCaption: string | null;
    questionType: "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";
    scaleMin: number;
    scaleMax: number;
    options: Array<{ id: string; text: string }>;
  }>,
  answers: StoredAnswer[],
) {
  const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  for (const question of questions) {
    const answer = answersByQuestion.get(question.id);
    if (!answer) return question;
    const validation = validateParticipantAnswer(question, {
      questionId: question.id,
      value: answer.value,
      optionId: answer.optionId,
      textValue: answer.textValue,
    });
    if (
      !validation.ok ||
      (validation.answer.kind === "FREE_TEXT" && validation.answer.clear)
    ) {
      return question;
    }
  }
  return null;
}

function objectAnswers(value: unknown): StoredAnswer[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value).filter((answer): answer is StoredAnswer => {
    return (
      Boolean(answer) &&
      typeof answer === "object" &&
      !Array.isArray(answer) &&
      typeof (answer as { questionId?: unknown }).questionId === "string"
    );
  });
}

async function claimSubmissionSnapshot(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    userId: string;
    answerSnapshot: string;
    submittedAt: Date;
  },
) {
  await lockAssessmentSession(tx, input.sessionId);
  const current = await tx.quizSession.findUnique({
    where: { id: input.sessionId },
    select: {
      userId: true,
      status: true,
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
  if (!current || current.userId !== input.userId) return "NOT_FOUND" as const;
  if (current.status !== "IN_PROGRESS") return "ALREADY_SUBMITTED" as const;
  if (serializeAnswerSnapshot(current.answers) !== input.answerSnapshot) {
    return "ANSWERS_CHANGED" as const;
  }

  await tx.quizSession.update({
    where: { id: input.sessionId },
    data: {
      status: "SUBMITTED",
      submittedAt: input.submittedAt,
      submissionClaimId: null,
      submissionClaimedAt: null,
      submissionAnswerSnapshotHash: null,
    },
  });
  return "CLAIMED" as const;
}

export async function POST(
  _req: NextRequest,
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
      include: {
        admin: { select: { tenantId: true } },
        assessment: {
          select: {
            id: true,
            questions: {
              orderBy: { sortOrder: "asc" },
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
                options: { select: { id: true, text: true } },
              },
            },
          },
        },
      },
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
    if (preview.status === "SUBMITTED") {
      return NextResponse.json({
        submitted: true,
        alreadySubmitted: true,
        previewMode: true,
        redirectTo: `/admin/assessments/${encodeURIComponent(preview.assessmentId)}`,
        postSubmitMessage: "Preview already completed. No participant data was changed.",
      });
    }

    const missing = validateCompleteness(
      preview.assessment.questions,
      objectAnswers(preview.answersJson),
    );
    if (missing) {
      return NextResponse.json(
        { error: `Please answer all questions before submitting. Missing: ${missing.prompt.slice(0, 60)}` },
        { status: 422 },
      );
    }

    const completion = await db.$transaction(async (tx) => {
      await lockAssessmentSession(tx, preview.id);
      const current = await tx.assessmentPreviewSession.findUnique({
        where: { id: preview.id },
        select: {
          adminId: true,
          status: true,
          expiresAt: true,
          answersJson: true,
        },
      });
      if (!current || current.adminId !== preview.adminId) {
        return { status: 404 as const, error: "Not found" };
      }
      if (current.expiresAt <= new Date()) {
        await tx.assessmentPreviewSession.delete({ where: { id: preview.id } });
        return {
          status: 410 as const,
          error: "This preview expired. Start a new preview from assessment settings.",
        };
      }
      if (current.status !== "IN_PROGRESS") {
        return { completed: false };
      }
      const currentMissing = validateCompleteness(
        preview.assessment.questions,
        objectAnswers(current.answersJson),
      );
      if (currentMissing) {
        return {
          status: 409 as const,
          error: `An answer changed before submission. Missing: ${currentMissing.prompt.slice(0, 60)}`,
        };
      }

      await tx.assessmentPreviewSession.update({
        where: { id: preview.id },
        data: { status: "SUBMITTED" },
      });
      await recordAuditLog(
        {
          tenantId: preview.admin.tenantId,
          actorId: preview.adminId,
          action: "ASSESSMENT_PREVIEW_COMPLETED",
          metadata: {
            assessmentId: preview.assessmentId,
            previewSessionId: preview.id,
          },
        },
        tx,
      );
      return { completed: true };
    });

    if ("error" in completion) {
      return NextResponse.json(
        { error: completion.error },
        { status: completion.status },
      );
    }

    return NextResponse.json({
      submitted: true,
      alreadySubmitted: !completion.completed,
      previewMode: true,
      redirectTo: `/admin/assessments/${encodeURIComponent(preview.assessmentId)}`,
      postSubmitMessage: "Preview completed. No participant score or report was generated.",
    });
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await resolveAssessmentAccess(session.userId, session.assessmentId);
  if (!access.canStartAssessment) {
    return NextResponse.json(
      { error: "Your access to this assessment is no longer active." },
      { status: 403 },
    );
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

  const missing = validateCompleteness(session.assessment.questions, session.answers);
  if (missing) {
    return NextResponse.json(
      { error: `Please answer all questions before submitting. Missing: ${missing.prompt.slice(0, 60)}` },
      { status: 422 },
    );
  }

  const answerSnapshot = serializeAnswerSnapshot(session.answers);
  const submittedAt = new Date();
  const reportWorkflow = session.assessment.policy?.reportWorkflow || "AI_STANDARD";
  const participantName =
    `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant";

  if (reportWorkflow === "MANUAL_PDF_UPLOAD") {
    const narrative = {
      assessmentTakenAt: submittedAt.toISOString(),
      assessmentTitle: session.assessment.title,
      participantName,
      reportVersion: "manual_pdf_v1",
      reportWorkflow,
      note: "Manual report workflow enabled. An administrator will upload the report PDF.",
    };

    const commitResult = await db.$transaction(async (tx) => {
      const claim = await claimSubmissionSnapshot(tx, {
        sessionId: id,
        userId: session.userId,
        answerSnapshot,
        submittedAt,
      });
      if (claim !== "CLAIMED") return claim;
      await tx.assessmentReportShareToken.updateMany({
        where: {
          assessmentId: session.assessmentId,
          userId: session.userId,
          revokedAt: null,
        },
        data: { revokedAt: submittedAt },
      });
      await tx.report.upsert({
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
      });
      return "CLAIMED" as const;
    });

    if (commitResult === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (commitResult === "ANSWERS_CHANGED") {
      return NextResponse.json(
        { error: "An answer changed while the assessment was being submitted. Review and submit again." },
        { status: 409 },
      );
    }
    const committed = commitResult === "CLAIMED";

    if (committed) {
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
    }

    return NextResponse.json({
      submitted: true,
      alreadySubmitted: !committed,
      postSubmitMessage:
        session.assessment.policy?.postSubmitMessage ||
        "Assessment completed. You will be notified once your report is available.",
    });
  }

  const submissionClaimId = randomUUID();
  const lease = await db.$transaction((tx) =>
    acquireAssessmentSubmissionClaim(tx, {
      sessionId: id,
      userId: session.userId,
      claimId: submissionClaimId,
      answerSnapshot,
      now: submittedAt,
    }),
  );
  if (lease.kind === "NOT_FOUND") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lease.kind === "ALREADY_SUBMITTED") {
    return NextResponse.json({
      submitted: true,
      alreadySubmitted: true,
      postSubmitMessage:
        session.assessment.policy?.postSubmitMessage ||
        "Thanks for completing your assessment.",
    });
  }
  if (lease.kind === "IN_PROGRESS") {
    return NextResponse.json(
      {
        error: "This submission is already being prepared. Wait a moment and try again.",
        code: "SUBMISSION_IN_PROGRESS",
        retryAfterSeconds: lease.retryAfterSeconds,
      },
      { status: 409 },
    );
  }
  if (lease.kind === "ANSWERS_CHANGED") {
    return NextResponse.json(
      {
        error: "An answer changed while submission was starting. Review and submit again.",
        code: "ANSWERS_CHANGED",
      },
      { status: 409 },
    );
  }

  const releaseClaim = () =>
    clearAssessmentSubmissionClaim(db, {
      sessionId: id,
      claimId: submissionClaimId,
    });

  try {
    const { traits, competencies } = computeScores(
      session.assessment.questions,
      session.answers,
    );
    const baseNarrative = generateNarrative(traits, competencies);
    const cprScores = {
      composite: Math.round((traits.conscientiousness + traits.openness) / 2),
      pattern: Math.round((traits.openness + traits.extraversion) / 2),
      recognition: Math.round(
        (traits.agreeableness + (100 - traits.neuroticism)) / 2,
      ),
    };
    const aiNarrative = await generateAiNarrative(traits, competencies, {
      participantReference: participantReference(session.userId),
      assessmentTitle: session.assessment.title,
    });
    const narrativeSource = {
      ...baseNarrative,
      assessmentTakenAt: submittedAt.toISOString(),
      assessmentTitle: session.assessment.title,
      participantName,
      cprScores,
      aiNarrative,
    };
    const narrative = canonicalizeReportNarrative({
      ...narrativeSource,
      adminEditedHtml: buildReportHtmlTemplate(narrativeSource, {
        assessmentTitle: session.assessment.title,
        participantName,
      }),
    });

    const currentAccess = await resolveAssessmentAccess(
      session.userId,
      session.assessmentId,
    );
    if (!currentAccess.canStartAssessment) {
      await releaseClaim();
      return NextResponse.json(
        { error: "Your access to this assessment is no longer active." },
        { status: 403 },
      );
    }
    const status =
      currentAccess.enrollmentReportMode === "MANUAL" ? "DRAFT" : "PUBLISHED";
    const availableAt =
      currentAccess.enrollmentReportMode === "AUTO" &&
      currentAccess.enrollmentReportDelayHours > 0
        ? new Date(
            submittedAt.getTime() +
              currentAccess.enrollmentReportDelayHours * 60 * 60 * 1000,
          )
        : submittedAt;

    const commitResult = await db.$transaction(async (tx) => {
      const verification = await verifyAssessmentSubmissionClaim(tx, {
        sessionId: id,
        userId: session.userId,
        claimId: submissionClaimId,
        answerSnapshot,
        answerSnapshotHash: lease.answerSnapshotHash,
      });
      if (verification !== "VERIFIED") return verification;
      await tx.score.upsert({
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
        update: { ...traits, competencyJson: competencies },
      });
      await tx.assessmentReportShareToken.updateMany({
        where: {
          assessmentId: session.assessmentId,
          userId: session.userId,
          revokedAt: null,
        },
        data: { revokedAt: submittedAt },
      });
      await tx.report.upsert({
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
          publicationGeneration: status === "PUBLISHED" ? 1 : 0,
          availableAt,
        },
        update: {
          narrativeJson: JSON.stringify(narrative),
          status,
          ...(status === "PUBLISHED"
            ? { publicationGeneration: { increment: 1 } }
            : {}),
          availableAt,
        },
      });
      await tx.quizSession.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          submittedAt,
          submissionClaimId: null,
          submissionClaimedAt: null,
          submissionAnswerSnapshotHash: null,
        },
      });
      return "CLAIMED" as const;
    });

    if (commitResult === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (commitResult === "ANSWERS_CHANGED") {
      return NextResponse.json(
        {
          error: "An answer changed while the report was being prepared. Review and submit again.",
          code: "ANSWERS_CHANGED",
        },
        { status: 409 },
      );
    }
    if (commitResult === "CLAIM_LOST") {
      return NextResponse.json(
        {
          error: "This submission was restarted by another request. Wait for it to finish before retrying.",
          code: "SUBMISSION_IN_PROGRESS",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      submitted: true,
      alreadySubmitted: commitResult === "ALREADY_SUBMITTED",
      postSubmitMessage:
        session.assessment.policy?.postSubmitMessage ||
        "Thanks for completing your assessment.",
    });
  } catch (error) {
    await releaseClaim().catch((releaseError) => {
      console.error("Failed to release submission claim after an error.", releaseError);
    });
    throw error;
  }
}
