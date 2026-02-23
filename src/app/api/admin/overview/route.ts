import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const [tenantCount, userCount, assessmentCount, sessionCount] = await Promise.all([
    db.tenant.count(),
    db.user.count(),
    db.assessment.count(),
    db.quizSession.count(),
  ]);

  return NextResponse.json({
    tenantCount,
    userCount,
    assessmentCount,
    sessionCount,
  });
}
