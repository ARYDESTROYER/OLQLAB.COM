import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const check = await requireSession();
  if ("error" in check) return check.error;

  const { assessmentId } = (await req.json()) as { assessmentId: string };
  const userId = check.session.user.id;

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  if (!assessment || !assessment.isPublished) {
    return NextResponse.json({ error: "Assessment unavailable" }, { status: 404 });
  }

  const session = await db.quizSession.upsert({
    where: { assessmentId_userId: { assessmentId, userId } },
    update: {},
    create: { assessmentId, userId },
    include: { answers: true },
  });

  return NextResponse.json({
    sessionId: session.id,
    questions: assessment.questions,
    answers: session.answers,
  });
}
