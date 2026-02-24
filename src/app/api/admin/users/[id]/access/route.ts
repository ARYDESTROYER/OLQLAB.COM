import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: userId } = await params;

  let user;
  try {
    user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacy = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    user = legacy
      ? {
          ...legacy,
          tenant: legacy.tenant
            ? {
                ...legacy.tenant,
                type: "ORGANIZATION",
              }
            : null,
        }
      : null;
  }

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  let assessments: Array<{
    id: string;
    title: string;
    isPublished: boolean;
    ownerTenantId: string | null;
  }> = [];
  try {
    assessments = await db.assessment.findMany({
      select: {
        id: true,
        title: true,
        isPublished: true,
        ownerTenantId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacyAssessments = await db.assessment.findMany({
      select: {
        id: true,
        title: true,
        isPublished: true,
        tenantId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });
    assessments = legacyAssessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      isPublished: assessment.isPublished,
      ownerTenantId: assessment.tenantId,
    }));
  }

  const access = await Promise.all(
    assessments.map(async (assessment) => {
      const resolved = await resolveAssessmentAccess(user.id, assessment.id);
      return {
        assessment,
        ...resolved,
      };
    }),
  );

  return NextResponse.json({
    user,
    access,
  });
}
