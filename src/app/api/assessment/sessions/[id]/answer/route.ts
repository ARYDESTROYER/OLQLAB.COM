import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { id } = await params;

  const { questionId, value } = (await req.json()) as {
    questionId: string;
    value: number;
  };

  const session = await db.quizSession.findUnique({ where: { id } });
  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const answer = await db.answer.upsert({
    where: { sessionId_questionId: { sessionId: id, questionId } },
    create: { sessionId: id, questionId, value },
    update: { value },
  });

  return NextResponse.json(answer);
}
