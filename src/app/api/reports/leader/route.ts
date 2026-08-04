import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireLeaderOrAdmin } from "@/lib/api-auth";
import { evaluateReportRelease } from "@/lib/report-release";
import {
  decodeLeaderReportCursor,
  encodeLeaderReportCursor,
  InvalidLeaderReportCursorError,
} from "@/lib/leader-report-pagination";

const PAGE_SIZE = 30;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function paginationFilter(
  cursor: ReturnType<typeof decodeLeaderReportCursor>,
): Prisma.QuizSessionWhereInput {
  if (!cursor) return {};

  if (cursor.submittedAt === null) {
    return {
      submittedAt: null,
      id: { lt: cursor.sessionId },
    };
  }

  return {
    OR: [
      { submittedAt: { lt: cursor.submittedAt } },
      {
        submittedAt: cursor.submittedAt,
        id: { lt: cursor.sessionId },
      },
      { submittedAt: null },
    ],
  };
}

export async function GET(request: Request) {
  const check = await requireLeaderOrAdmin();
  if ("error" in check) {
    check.error.headers.set("Cache-Control", "no-store");
    return check.error;
  }
  if (check.liveUser.role !== "LEADER") {
    return NextResponse.json(
      { reports: [], nextCursor: null },
      { headers: NO_STORE_HEADERS },
    );
  }

  let cursor: ReturnType<typeof decodeLeaderReportCursor>;
  try {
    cursor = decodeLeaderReportCursor(new URL(request.url).searchParams.get("cursor"));
  } catch (error) {
    if (error instanceof InvalidLeaderReportCursorError) {
      return NextResponse.json(
        { error: "Invalid pagination cursor." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }

  const sessions = await db.quizSession.findMany({
    where: {
      status: "SUBMITTED",
      user: {
        is: {
          managerId: check.liveUser.id,
          tenantId: check.liveUser.tenantId,
          role: { in: ["EMPLOYEE", "LEADER"] },
        },
      },
      assessment: {
        is: {
          policy: { is: { leaderCanViewFullReport: true } },
        },
      },
      ...paginationFilter(cursor),
    },
    select: {
      id: true,
      userId: true,
      assessmentId: true,
      submittedAt: true,
      user: { select: { firstName: true, lastName: true } },
      assessment: { select: { title: true, policy: true } },
    },
    orderBy: [
      { submittedAt: { sort: "desc", nulls: "last" } },
      { id: "desc" },
    ],
    take: PAGE_SIZE + 1,
  });

  const hasMore = sessions.length > PAGE_SIZE;
  const pageSessions = sessions.slice(0, PAGE_SIZE);
  const reports =
    pageSessions.length === 0
      ? []
      : await db.report.findMany({
          where: {
            OR: pageSessions.map((session) => ({
              userId: session.userId,
              assessmentId: session.assessmentId,
            })),
          },
          select: {
            userId: true,
            assessmentId: true,
            status: true,
            availableAt: true,
            pdfAsset: { select: { id: true } },
          },
        });
  const reportByKey = new Map(
    reports.map((report) => [`${report.assessmentId}:${report.userId}`, report]),
  );

  const rows = pageSessions.flatMap((session) => {
    const policy = session.assessment.policy;
    if (!policy?.leaderCanViewFullReport) return [];
    const report = reportByKey.get(`${session.assessmentId}:${session.userId}`) || null;
    const decision = evaluateReportRelease({
      audience: "LEADER",
      report: report
        ? {
            status: report.status,
            availableAt: report.availableAt,
            hasManualPdf: Boolean(report.pdfAsset),
          }
        : null,
      policy,
      submittedAt: session.submittedAt,
    });
    return [
      {
        userId: session.userId,
        assessmentId: session.assessmentId,
        participantName:
          `${session.user.firstName} ${session.user.lastName}`.trim() || "Participant",
        assessmentTitle: session.assessment.title,
        submittedAt: session.submittedAt,
        ready: decision.ready,
        statusMessage: decision.ready ? null : decision.message,
        href: decision.ready
          ? `/reports/leader/${encodeURIComponent(session.userId)}/${encodeURIComponent(session.assessmentId)}`
          : null,
      },
    ];
  });

  const lastSession = pageSessions.at(-1);
  const nextCursor =
    hasMore && lastSession
      ? encodeLeaderReportCursor({
          sessionId: lastSession.id,
          submittedAt: lastSession.submittedAt,
        })
      : null;

  return NextResponse.json(
    { reports: rows, nextCursor },
    { headers: NO_STORE_HEADERS },
  );
}
