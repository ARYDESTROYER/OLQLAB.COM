import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  REPORT_HISTORY_LIMIT,
  takeBoundedReportHistory,
} from "@/lib/report-archive-history";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const [sessionRows, archiveRows] = await Promise.all([
    db.quizSession.findMany({
      where: {
        userId,
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: REPORT_HISTORY_LIMIT + 1,
    }),
    db.reportArchive.findMany({
      where: { userId },
      select: {
        id: true,
        assessmentId: true,
        submittedAt: true,
        archivedAt: true,
        archiveReason: true,
        assessmentTitle: true,
        assessment: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [{ archivedAt: "desc" }, { id: "desc" }],
      take: REPORT_HISTORY_LIMIT + 1,
    }),
  ]);

  const sessions = takeBoundedReportHistory(sessionRows);
  const archives = takeBoundedReportHistory(archiveRows);

  return NextResponse.json({
    user,
    testsTaken: sessions.items,
    testsTakenHasMore: sessions.hasMore,
    reportArchives: archives.items.map((archive) => ({
      id: archive.id,
      assessmentId: archive.assessmentId,
      assessmentTitle: archive.assessmentTitle || archive.assessment.title,
      submittedAt: archive.submittedAt,
      archivedAt: archive.archivedAt,
      archiveReason: archive.archiveReason,
    })),
    reportArchivesHasMore: archives.hasMore,
    historyLimit: REPORT_HISTORY_LIMIT,
  });
}
