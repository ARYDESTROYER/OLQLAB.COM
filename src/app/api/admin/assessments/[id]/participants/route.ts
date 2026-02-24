import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const assessment = await db.assessment.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const users = await db.user.findMany({
    where: {
      tenantId: assessment.tenantId,
      role: { in: ["EMPLOYEE", "LEADER"] },
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      manager: {
        select: {
          email: true,
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const userIds = users.map((user) => user.id);
  const sessions = userIds.length
    ? await db.quizSession.findMany({
        where: {
          assessmentId: id,
          userId: { in: userIds },
        },
        select: {
          userId: true,
          status: true,
          startedAt: true,
          submittedAt: true,
        },
      })
    : [];

  const retestEligibility = userIds.length
    ? await db.retestEligibility.findMany({
        where: {
          assessmentId: id,
          userId: { in: userIds },
        },
        select: {
          userId: true,
          eligibleAt: true,
        },
      })
    : [];

  const sessionByUser = new Map(sessions.map((session) => [session.userId, session]));
  const retestByUser = new Map(
    retestEligibility.map((item) => [item.userId, item.eligibleAt]),
  );
  const now = new Date();

  const participants = users.map((user) => {
    const userSession = sessionByUser.get(user.id);
    const retestEligibleAt = retestByUser.get(user.id) || null;
    const canRetestNow = retestEligibleAt ? now >= retestEligibleAt : false;
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      managerEmail: user.manager?.email || null,
      status: userSession?.status || "NOT_STARTED",
      startedAt: userSession?.startedAt || null,
      submittedAt: userSession?.submittedAt || null,
      retestEligibleAt,
      canRetestNow,
    };
  });

  return NextResponse.json({ participants });
}
