import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lookupReportShareToken } from "@/lib/unenroll-jobs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const tokenRow = await lookupReportShareToken(token);
  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }

  const [score, report, session] = await Promise.all([
    db.score.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: tokenRow.assessmentId,
          userId: tokenRow.userId,
        },
      },
    }),
    db.report.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: tokenRow.assessmentId,
          userId: tokenRow.userId,
        },
      },
    }),
    db.quizSession.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: tokenRow.assessmentId,
          userId: tokenRow.userId,
        },
      },
      select: {
        submittedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    assessment: {
      id: tokenRow.assessment.id,
      title: tokenRow.assessment.title,
    },
    participant: {
      id: tokenRow.user.id,
      firstName: tokenRow.user.firstName,
      lastName: tokenRow.user.lastName,
      email: tokenRow.user.email,
    },
    submittedAt: session?.submittedAt || null,
    score,
    narrative: report && report.status === "PUBLISHED" ? JSON.parse(report.narrativeJson) : null,
    shareLink: {
      expiresAt: tokenRow.expiresAt,
      remainingDownloads: Math.max(tokenRow.maxDownloads - tokenRow.downloadsUsed, 0),
    },
  });
}
