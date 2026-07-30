import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { archiveCurrentAttempt } from "@/lib/report-archive";
import { isMissingTableError } from "@/lib/prisma-errors";
import { hasAnyAssessmentParticipation } from "@/lib/assessment-access";
import { recordAuditLog } from "@/lib/audit-log";
import { revokeAttemptShareTokens } from "@/lib/report-attempt-access";
import { lockAssessmentSession } from "@/lib/assessment-session-lock";
import { lockAssessmentContent } from "@/lib/assessment-content-lock";

async function validateParticipantScope(assessmentId: string, userId: string) {
  const [assessment, participant, hasParticipation] = await Promise.all([
    db.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, tenantId: true },
    }),
    hasAnyAssessmentParticipation(assessmentId, userId),
  ]);

  if (!assessment) {
    return {
      error: NextResponse.json({ error: "Assessment not found." }, { status: 404 }),
    };
  }

  if (!participant) {
    return {
      error: NextResponse.json({ error: "Participant not found." }, { status: 404 }),
    };
  }

  if (participant.role === "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Reset controls apply only to employee or leader accounts." },
        { status: 400 },
      ),
    };
  }

  if (!hasParticipation) {
    return {
      error: NextResponse.json(
        { error: "Participant is not currently enrolled and has no attempt history." },
        { status: 400 },
      ),
    };
  }

  return { assessment, participant };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId, userId } = await params;
  const scope = await validateParticipantScope(assessmentId, userId);
  if ("error" in scope) return scope.error;

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    // Content lock must precede any per-session lock. This serializes the
    // no-session reset branch with question/image writes before it creates the
    // assessment's first historical attempt.
    await lockAssessmentContent(tx, assessmentId);
    const existingSession = await tx.quizSession.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
      select: { id: true },
    });
    if (existingSession) {
      await lockAssessmentSession(tx, existingSession.id);
    }

    const archived = await archiveCurrentAttempt(tx, {
      assessmentId,
      userId,
      archivedById: check.session.user.id,
      reason: "admin_reset_stats",
    });

    await tx.score.deleteMany({
      where: {
        assessmentId,
        userId,
      },
    });
    await tx.report.deleteMany({
      where: {
        assessmentId,
        userId,
      },
    });
    const revokedShareTokens = await revokeAttemptShareTokens(tx, {
      assessmentId,
      userId,
      revokedAt: now,
    });

    let resetSessionId: string;
    if (existingSession) {
      await tx.answer.deleteMany({ where: { sessionId: existingSession.id } });
      const resetSession = await tx.quizSession.update({
        where: { id: existingSession.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: now,
          submittedAt: null,
          submissionClaimId: null,
          submissionClaimedAt: null,
          submissionAnswerSnapshotHash: null,
        },
        select: { id: true },
      });
      resetSessionId = resetSession.id;
    } else {
      const resetSession = await tx.quizSession.create({
        data: {
          assessmentId,
          userId,
          status: "IN_PROGRESS",
          startedAt: now,
        },
        select: { id: true },
      });
      resetSessionId = resetSession.id;
    }

    let retestEligibleAt: Date | null = null;
    try {
      const eligibility = await tx.retestEligibility.upsert({
        where: {
          assessmentId_userId: {
            assessmentId,
            userId,
          },
        },
        create: {
          assessmentId,
          userId,
          eligibleAt: now,
          setByAdminId: check.session.user.id,
        },
        update: {
          eligibleAt: now,
          setByAdminId: check.session.user.id,
        },
        select: {
          eligibleAt: true,
        },
      });
      retestEligibleAt = eligibility.eligibleAt;
    } catch (error) {
      if (!isMissingTableError(error, "retesteligibility")) throw error;
    }

    await recordAuditLog(
      {
        tenantId: scope.participant.tenantId,
        actorId: check.session.user.id,
        action: "ASSESSMENT_PARTICIPANT_RESET",
        metadata: {
          assessmentId,
          userId,
          archivedReportId: archived?.id || null,
          resetSessionId,
          revokedShareTokens,
        },
      },
      tx,
    );

    return {
      archivedId: archived?.id || null,
      sessionId: resetSessionId,
      retestEligibleAt,
    };
  });

  return NextResponse.json({
    ok: true,
    assessmentId,
    userId,
    reset: true,
    sessionId: result.sessionId,
    archivedReportId: result.archivedId,
    retestEligibleAt: result.retestEligibleAt,
    canRetestNow: Boolean(
      result.retestEligibleAt && new Date() >= new Date(result.retestEligibleAt),
    ),
  });
}
