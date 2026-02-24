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
      assessment: {
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
      },
      answers: true,
    },
  });

  if (!session || session.userId !== check.session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    assessmentId: session.assessmentId,
    sections: session.assessment.sections,
    questions: session.assessment.questions,
    answers: session.answers,
    status: session.status,
  });
}
