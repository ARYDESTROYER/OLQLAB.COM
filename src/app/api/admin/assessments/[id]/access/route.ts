import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { listResolvedAssessmentUsers } from "@/lib/assessment-access";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim();

  let assessment;
  try {
    assessment = await db.assessment.findUnique({
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
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacy = await db.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        title: true,
        isPublished: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    assessment = legacy
      ? {
          ...legacy,
          ownerTenant: legacy.tenant,
        }
      : null;
  }

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  let userEnrollments: Array<Record<string, unknown>> = [];
  let tenantEnrollments: Array<Record<string, unknown>> = [];
  let activeUsers: Awaited<ReturnType<typeof listResolvedAssessmentUsers>> = [];
  let pendingJobs: Array<Record<string, unknown>> = [];

  try {
    [userEnrollments, tenantEnrollments, activeUsers, pendingJobs] = await Promise.all([
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
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    activeUsers = await listResolvedAssessmentUsers(assessmentId, q);
    userEnrollments = [];
    tenantEnrollments = [];
    pendingJobs = [];
  }

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
