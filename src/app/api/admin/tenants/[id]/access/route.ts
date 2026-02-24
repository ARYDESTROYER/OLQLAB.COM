import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: tenantId } = await params;

  let tenant: {
    id: string;
    name: string;
    type: string;
    seatLimit: number;
    isArchived: boolean;
  } | null = null;
  try {
    tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        seatLimit: true,
        isArchived: true,
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacyTenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        seatLimit: true,
      },
    });
    tenant = legacyTenant
      ? {
          ...legacyTenant,
          type: "ORGANIZATION",
          isArchived: false,
        }
      : null;
  }

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  let enrollments: Array<Record<string, unknown>> = [];
  let assessments: Array<Record<string, unknown>> = [];
  try {
    [enrollments, assessments] = await Promise.all([
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
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    enrollments = [];
    assessments = await db.assessment.findMany({
      where: {
        tenantId,
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
    });
  }

  return NextResponse.json({
    tenant,
    enrollments,
    assessments,
  });
}
