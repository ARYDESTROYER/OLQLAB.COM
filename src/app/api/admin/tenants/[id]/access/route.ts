import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: tenantId } = await params;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      type: true,
      seatLimit: true,
      isArchived: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const [enrollments, assessments] = await Promise.all([
    db.assessmentTenantEnrollment.findMany({
      where: {
        tenantId,
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            isPublished: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.assessment.findMany({
      where: {
        tenantEnrollments: {
          some: {
            tenantId,
            active: true,
          },
        },
      },
      select: {
        id: true,
        title: true,
        isPublished: true,
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return NextResponse.json({
    tenant,
    enrollments,
    assessments,
  });
}
