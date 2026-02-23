import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { id } = await params;

  const session = await db.quizSession.findUnique({
    where: { id },
    include: {
      assessment: { include: { questions: { orderBy: { sortOrder: "asc" } } } },
      answers: true,
    },
  });

  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    assessmentId: session.assessmentId,
    questions: session.assessment.questions,
    answers: session.answers,
    status: session.status,
  });
}
