import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { listResolvedAssessmentUsers } from "@/lib/assessment-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      isPublished: true,
      ownerTenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  const [userEnrollments, tenantEnrollments, activeUsers, pendingJobs] = await Promise.all([
    db.assessmentUserEnrollment.findMany({
      where: {
        assessmentId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.assessmentTenantEnrollment.findMany({
      where: {
        assessmentId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    listResolvedAssessmentUsers(assessmentId, q),
    db.assessmentUnenrollJob.findMany({
      where: {
        assessmentId,
        status: {
          in: ["PENDING", "FAILED"],
        },
      },
      orderBy: {
        effectiveAt: "asc",
      },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    assessment,
    enrollments: {
      users: userEnrollments,
      tenants: tenantEnrollments,
    },
    activeUsers,
    pendingJobs,
  });
}
