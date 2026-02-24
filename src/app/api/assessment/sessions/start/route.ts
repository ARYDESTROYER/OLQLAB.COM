import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { archiveCurrentAttempt } from "@/lib/report-archive";

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

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const assessment = await db.assessment.findFirst({
    where: {
      id: assessmentId,
      tenantId: user.tenantId,
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
                include: { competency: true },
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

  const seat = await db.seat.findUnique({
    where: {
      tenantId_userEmail: {
        tenantId: user.tenantId,
        userEmail: user.email.toLowerCase(),
      },
    },
  });

  if (!seat) {
    return NextResponse.json({ error: "You are not assigned to this assessment tenant." }, { status: 403 });
  }

  const existingSession = await db.quizSession.findUnique({
    where: { assessmentId_userId: { assessmentId, userId } },
    include: { answers: true },
  });

  let session = existingSession;

  if (existingSession?.status === "SUBMITTED") {
    const retest = await db.retestEligibility.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
    });

    const now = new Date();
    const canRetest = Boolean(retest && now >= retest.eligibleAt);

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
