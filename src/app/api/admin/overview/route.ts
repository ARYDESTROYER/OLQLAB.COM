import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { isMissingTableError } from "@/lib/prisma-errors";
import { getAdminUserStats } from "@/lib/admin-user-stats";

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const [tenantCount, userStats, assessmentCount, sessionCount] = await Promise.all([
    db.tenant.count(),
    getAdminUserStats(),
    db.assessment.count(),
    db.quizSession.count(),
  ]);

  let pendingUnenrollJobs = 0;
  try {
    pendingUnenrollJobs = await db.assessmentUnenrollJob.count({
      where: {
        status: "PENDING",
      },
    });
  } catch (error) {
    if (!isMissingTableError(error, "assessmentunenrolljob")) throw error;
    pendingUnenrollJobs = 0;
  }

  return NextResponse.json({
    tenantCount,
    userCount: userStats.usersTotal,
    usersTotal: userStats.usersTotal,
    usersParticipants: userStats.usersParticipants,
    usersAdmins: userStats.usersAdmins,
    usersInArchivedTenants: userStats.usersInArchivedTenants,
    usersInSoloTenants: userStats.usersInSoloTenants,
    assessmentCount,
    sessionCount,
    pendingUnenrollJobs,
  });
}
