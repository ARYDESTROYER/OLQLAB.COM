import { addHours } from "date-fns";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { assessmentId } = await params;

  const session = await db.quizSession.findUnique({
    where: {
      assessmentId_userId: {
        assessmentId,
        userId: check.session.user.id,
      },
    },
    include: {
      assessment: { include: { policy: true } },
    },
  });

  if (!session || session.status !== "SUBMITTED") {
    return NextResponse.json({ error: "No submitted report" }, { status: 404 });
  }

  const policy = session.assessment.policy;
  if (!policy?.showResultsToEmployee) {
    return NextResponse.json({
      message: "Your organization has chosen not to release individual results.",
    });
  }

  if (session.submittedAt) {
    const releaseAt = addHours(session.submittedAt, policy.resultReleaseDelayHours);
    if (new Date() < releaseAt) {
      return NextResponse.json({
        message: `Results will be available after ${releaseAt.toISOString()}.`,
      });
    }
  }

  const score = await db.score.findUnique({
    where: { assessmentId_userId: { assessmentId, userId: check.session.user.id } },
  });
  const report = await db.report.findUnique({
    where: { assessmentId_userId: { assessmentId, userId: check.session.user.id } },
  });

  return NextResponse.json({
    assessment: {
      id: session.assessment.id,
      title: session.assessment.title,
    },
    submittedAt: session.submittedAt,
    score,
    narrative: report ? JSON.parse(report.narrativeJson) : null,
  });
}
