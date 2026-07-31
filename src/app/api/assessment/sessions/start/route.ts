import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { archiveCurrentAttempt } from "@/lib/report-archive";
import { isMissingTableError } from "@/lib/prisma-errors";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { recordAuditLog } from "@/lib/audit-log";
import { revokeAttemptShareTokens } from "@/lib/report-attempt-access";
import { lockAssessmentSession } from "@/lib/assessment-session-lock";
import { lockAssessmentContent } from "@/lib/assessment-content-lock";
import { ASSESSMENT_RESPONSE_ACKNOWLEDGEMENT } from "@/lib/assessment-response-acknowledgement";

export async function POST(req: NextRequest) {
  const check = await requireSession();
  if ("error" in check) return check.error;

  let assessmentId = "";
  let acknowledged = false;
  try {
    const body = (await req.json()) as { assessmentId?: string; acknowledged?: boolean };
    assessmentId = body.assessmentId?.trim() || "";
    acknowledged = body.acknowledged === true;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required." }, { status: 400 });
  }
  if (!acknowledged) {
    return NextResponse.json(
      { error: "Acknowledge response processing before starting." },
      { status: 422 },
    );
  }

  const userId = check.session.user.id;

  const access = await resolveAssessmentAccess(userId, assessmentId);
  if (!access.assessmentExists) {
    return NextResponse.json({ error: "Assessment unavailable" }, { status: 404 });
  }

  if (!access.canStartAssessment) {
    return NextResponse.json(
      {
        error: "You are not enrolled in this assessment.",
        access,
      },
      { status: 403 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      tenantId: true,
      email: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const assessment = await db.assessment.findFirst({
    where: {
      id: assessmentId,
      isPublished: true,
    },
    select: { id: true },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment unavailable" }, { status: 404 });
  }

  await recordAuditLog({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "ASSESSMENT_RESPONSE_PROCESSING_ACKNOWLEDGED",
    metadata: {
      assessmentId,
      acknowledgementVersion: ASSESSMENT_RESPONSE_ACKNOWLEDGEMENT.version,
      acknowledgementText: ASSESSMENT_RESPONSE_ACKNOWLEDGEMENT.text,
    },
  });

  // Keep seat assignment synchronized when seat record exists for this user's tenant.
  const seat = await db.seat.findUnique({
    where: {
      tenantId_userEmail: {
        tenantId: user.tenantId,
        userEmail: user.email.toLowerCase(),
      },
    },
  });

  if (seat && !seat.assigned) {
    await db.seat.update({
      where: {
        tenantId_userEmail: {
          tenantId: user.tenantId,
          userEmail: user.email.toLowerCase(),
        },
      },
      data: {
        assigned: true,
      },
    });
  }

  const existingSession = await db.quizSession.findUnique({
    where: { assessmentId_userId: { assessmentId, userId } },
  });

  let session = existingSession;

  if (existingSession?.status === "SUBMITTED") {
    let retest: { eligibleAt: Date } | null = null;
    let retestTableAvailable = true;
    try {
      retest = await db.retestEligibility.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId,
            userId,
          },
        },
        select: {
          eligibleAt: true,
        },
      });
    } catch (error) {
      if (!isMissingTableError(error, "retesteligibility")) throw error;
      retestTableAvailable = false;
    }

    const now = new Date();
    const canRetest = retestTableAvailable && Boolean(retest && now >= retest.eligibleAt);

    if (!canRetest) {
      return NextResponse.json({
        sessionId: existingSession.id,
        alreadySubmitted: true,
        retestAvailable: false,
        retestEligibleAt: retest?.eligibleAt || null,
      });
    }

    session = await db.$transaction(async (tx) => {
      await lockAssessmentSession(tx, existingSession.id);
      const currentSession = await tx.quizSession.findUnique({
        where: { id: existingSession.id },
      });
      if (!currentSession || currentSession.status !== "SUBMITTED") {
        return currentSession;
      }
      const currentEligibility = await tx.retestEligibility.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId,
            userId,
          },
        },
        select: { eligibleAt: true },
      });
      if (!currentEligibility || now < currentEligibility.eligibleAt) {
        return currentSession;
      }

      await archiveCurrentAttempt(tx, {
        assessmentId,
        userId,
        archivedById: userId,
        reason: "scheduled_retest_started",
      });

      await tx.answer.deleteMany({ where: { sessionId: existingSession.id } });
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
      await revokeAttemptShareTokens(tx, {
        assessmentId,
        userId,
        revokedAt: now,
      });
      await tx.retestEligibility.deleteMany({
        where: {
          assessmentId,
          userId,
        },
      });

      return tx.quizSession.update({
        where: { id: existingSession.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: now,
          submittedAt: null,
          submissionClaimId: null,
          submissionClaimedAt: null,
          submissionAnswerSnapshotHash: null,
        },
      });
    });
  }

  if (!session) {
    session = await db.$transaction(async (tx) => {
      await lockAssessmentContent(tx, assessmentId);
      const current = await tx.quizSession.findUnique({
        where: { assessmentId_userId: { assessmentId, userId } },
      });
      if (current) return current;
      return tx.quizSession.create({
        data: { assessmentId, userId },
      });
    });
  }

  return NextResponse.json({
    sessionId: session.id,
    alreadySubmitted: session.status === "SUBMITTED",
    retestAvailable: false,
    retestEligibleAt: null,
  });
}
