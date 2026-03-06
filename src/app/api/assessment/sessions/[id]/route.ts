import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

type QuestionRow = {
  id: string;
  sectionId: string | null;
  sortOrder: number;
};

function seededShuffle<T extends QuestionRow>(items: T[], seed: string) {
  const out = [...items];
  let state = Number.parseInt(
    createHash("sha256").update(seed).digest("hex").slice(0, 8),
    16,
  );

  for (let i = out.length - 1; i > 0; i -= 1) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    const rand = Math.abs(state) % (i + 1);
    const swapIndex = Number.isFinite(rand) ? rand : 0;
    [out[i], out[swapIndex]] = [out[swapIndex], out[i]];
  }

  return out;
}

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
      assessment: {
        include: {
          policy: {
            select: {
              randomizeQuestionOrder: true,
            },
          },
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
      },
      answers: true,
    },
  });

  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const shouldRandomize = Boolean(session.assessment.policy?.randomizeQuestionOrder);
  const orderedQuestions = shouldRandomize
    ? seededShuffle(session.assessment.questions, session.id)
    : session.assessment.questions;

  return NextResponse.json({
    sessionId: session.id,
    assessmentId: session.assessmentId,
    randomized: shouldRandomize,
    sections: shouldRandomize ? [] : session.assessment.sections,
    questions: orderedQuestions,
    answers: session.answers,
    status: session.status,
  });
}
