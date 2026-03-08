import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const userId = check.session.user.id;

  const [user, assessment] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        email: true,
      },
    }),
    db.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

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
    where: {
      assessmentId_userId: {
        assessmentId,
        userId,
      },
    },
  });

  const now = new Date();

  const session = existingSession
    ? await db.$transaction(async (tx) => {
        await tx.answer.deleteMany({ where: { sessionId: existingSession.id } });
        await tx.score.deleteMany({ where: { assessmentId, userId } });
        await tx.report.deleteMany({ where: { assessmentId, userId } });
        await tx.retestEligibility.deleteMany({ where: { assessmentId, userId } });

        return tx.quizSession.update({
          where: { id: existingSession.id },
          data: {
            status: "IN_PROGRESS",
            startedAt: now,
            submittedAt: null,
          },
        });
      })
    : await db.quizSession.create({
        data: {
          assessmentId,
          userId,
          startedAt: now,
        },
      });

  return NextResponse.json({
    sessionId: session.id,
    previewMode: true,
  });
}