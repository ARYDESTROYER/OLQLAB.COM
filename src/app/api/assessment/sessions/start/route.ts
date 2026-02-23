import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

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

  const session = await db.quizSession.upsert({
    where: { assessmentId_userId: { assessmentId, userId } },
    update: {},
    create: { assessmentId, userId },
    include: { answers: true },
  });

  return NextResponse.json({
    sessionId: session.id,
    alreadySubmitted: session.status === "SUBMITTED",
    sections: assessment.sections,
    questions: assessment.questions,
    answers: session.answers,
  });
}
