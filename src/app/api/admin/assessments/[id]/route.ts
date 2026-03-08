import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  let assessment;
  try {
    assessment = await db.assessment.findUnique({
      where: { id },
      include: {
        policy: true,
        ownerTenant: {
          select: {
            id: true,
            name: true,
          },
        },
        assessmentCompetencies: {
          orderBy: {
            name: "asc",
          },
        },
        _count: {
          select: {
            sections: true,
            questions: true,
            sessions: true,
            userEnrollments: true,
            tenantEnrollments: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacy = await db.assessment.findUnique({
      where: { id },
      include: {
        policy: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            sections: true,
            questions: true,
            sessions: true,
          },
        },
      },
    });
    assessment = legacy
      ? {
          ...legacy,
          ownerTenantId: legacy.tenantId,
          ownerTenant: legacy.tenant || null,
          assessmentCompetencies: [],
          _count: {
            ...legacy._count,
            userEnrollments: 0,
            tenantEnrollments: 0,
          },
        }
      : null;
  }

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  return NextResponse.json({ assessment });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        ownerTenantId?: string | null;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = body.title?.trim();
  const ownerTenantId = body.ownerTenantId?.trim() || null;

  if (ownerTenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: ownerTenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Owner organisation not found." }, { status: 404 });
    }
  }

  let updated;
  try {
    updated = await db.assessment.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ownerTenantId,
        tenantId: ownerTenantId,
      },
      include: {
        ownerTenant: {
          select: {
            id: true,
            name: true,
          },
        },
        policy: true,
        _count: {
          select: {
            sections: true,
            questions: true,
            sessions: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    updated = await db.assessment.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        tenantId: ownerTenantId || undefined,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        policy: true,
        _count: {
          select: {
            sections: true,
            questions: true,
            sessions: true,
          },
        },
      },
    });
    updated = {
      ...updated,
      ownerTenant: updated.tenant || null,
      ownerTenantId: updated.tenantId,
    };
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;

  await db.assessment.delete({
    where: { id },
  });

  return NextResponse.json({
    ok: true,
    deletedAssessmentId: id,
  });
}
