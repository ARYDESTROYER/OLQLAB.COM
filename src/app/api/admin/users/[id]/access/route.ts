import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { resolveAssessmentAccess } from "@/lib/assessment-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: userId } = await params;

  const user = await db.user.findUnique({
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

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const assessments = await db.assessment.findMany({
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
