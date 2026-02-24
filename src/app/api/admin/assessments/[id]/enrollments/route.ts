import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

type EnrollmentBody = {
  scope?: "USER" | "TENANT";
  targetId?: string;
  includeFutureUsers?: boolean;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const body = (await req.json().catch(() => null)) as EnrollmentBody | null;

  const scope = body?.scope;
  const targetId = body?.targetId?.trim();

  if (!scope || !targetId) {
    return NextResponse.json(
      { error: "scope and targetId are required." },
      { status: 400 },
    );
  }

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (scope === "USER") {
    const user = await db.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.role === "ADMIN") {
      return NextResponse.json(
        { error: "Admin users cannot be enrolled as assessment participants." },
        { status: 400 },
      );
    }

    let enrollment;
    try {
      enrollment = await db.assessmentUserEnrollment.upsert({
        where: {
          assessmentId_userId: {
            assessmentId,
            userId: user.id,
          },
        },
        create: {
          assessmentId,
          userId: user.id,
          active: true,
          createdByAdminId: check.session.user.id,
        },
        update: {
          active: true,
          createdByAdminId: check.session.user.id,
        },
      });
    } catch (error) {
      if (!isSchemaCompatibilityError(error)) throw error;
      return NextResponse.json(
        { error: "Database migration required for explicit enrollment actions." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      enrollment,
      scope,
      targetId: user.id,
    });
  }

  let tenant: { id: string; isArchived: boolean } | null = null;
  try {
    tenant = await db.tenant.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        isArchived: true,
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacyTenant = await db.tenant.findUnique({
      where: { id: targetId },
      select: {
        id: true,
      },
    });
    tenant = legacyTenant
      ? {
          id: legacyTenant.id,
          isArchived: false,
        }
      : null;
  }

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  if (tenant.isArchived) {
    return NextResponse.json(
      { error: "Cannot enroll an archived tenant." },
      { status: 400 },
    );
  }

  let enrollment;
  try {
    enrollment = await db.assessmentTenantEnrollment.upsert({
      where: {
        assessmentId_tenantId: {
          assessmentId,
          tenantId: tenant.id,
        },
      },
      create: {
        assessmentId,
        tenantId: tenant.id,
        includeFutureUsers: body?.includeFutureUsers ?? true,
        active: true,
        createdByAdminId: check.session.user.id,
      },
      update: {
        active: true,
        includeFutureUsers: body?.includeFutureUsers ?? true,
        createdByAdminId: check.session.user.id,
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    return NextResponse.json(
      { error: "Database migration required for explicit enrollment actions." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    enrollment,
    scope,
    targetId: tenant.id,
  });
}
