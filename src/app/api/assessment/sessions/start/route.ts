import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { archiveCurrentAttempt } from "@/lib/report-archive";
import { isMissingTableError } from "@/lib/prisma-errors";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

export async function POST(req: NextRequest) {
  const check = await requireSession();
  if ("error" in check) return check.error;

  let assessmentId = "";
  try {
    const body = (await req.json()) as { assessmentId?: string };
    assessmentId = body.assessmentId?.trim() || "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required." }, { status: 400 });
  }

  const userId = check.session.user.id;

  await runDueUnenrollJobs({
    assessmentId,
    userId,
  });

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
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          section: true,
          options: {
            orderBy: { displayOrder: "asc" },
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
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment unavailable" }, { status: 404 });
  }

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
    include: { answers: true },
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
        sections: assessment.sections,
        questions: assessment.questions,
        answers: existingSession.answers,
      });
    }

    session = await db.$transaction(async (tx) => {
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
        },
        include: { answers: true },
      });
    });
  }

  if (!session) {
    session = await db.quizSession.create({
      data: { assessmentId, userId },
      include: { answers: true },
    });
  }

  return NextResponse.json({
    sessionId: session.id,
    alreadySubmitted: session.status === "SUBMITTED",
    retestAvailable: false,
    retestEligibleAt: null,
    sections: assessment.sections,
    questions: assessment.questions,
    answers: session.answers,
  });
}
