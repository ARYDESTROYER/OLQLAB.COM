import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string; assessmentId: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;

  const { userId, assessmentId } = await params;
  if (!["LEADER", "ADMIN"].includes(check.session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employee = await db.user.findUnique({ where: { id: userId } });
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (check.session.user.role === "LEADER") {
    const sameTenant = employee.tenantId === check.session.user.tenantId;
    const isManager = employee.managerId === check.session.user.id;
    if (!sameTenant || !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, title: true, policy: true },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!assessment?.policy?.leaderCanViewFullReport) {
    return NextResponse.json({ error: "Leader access disabled" }, { status: 403 });
  }

  const score = await db.score.findUnique({
    where: { assessmentId_userId: { assessmentId, userId } },
  });
  const report = await db.report.findUnique({
    where: { assessmentId_userId: { assessmentId, userId } },
  });
  const session = await db.quizSession.findUnique({
    where: {
      assessmentId_userId: {
        assessmentId,
        userId,
      },
    },
    select: { submittedAt: true },
  });

  return NextResponse.json({
    employee: {
      id: employee.id,
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
    },
    assessment: {
      id: assessment.id,
      title: assessment.title,
    },
    submittedAt: session?.submittedAt || null,
    score,
    narrative: report && report.status === "PUBLISHED" ? JSON.parse(report.narrativeJson) : null,
  });
}
