import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
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
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
  const hasOwnerTenantId = Object.prototype.hasOwnProperty.call(body, "ownerTenantId");
  if (!hasTitle && !hasOwnerTenantId) {
    return NextResponse.json({ error: "No assessment changes were supplied." }, { status: 400 });
  }

  if (hasTitle && (typeof body.title !== "string" || !body.title.trim())) {
    return NextResponse.json({ error: "Assessment title is required." }, { status: 400 });
  }
  if (
    hasOwnerTenantId &&
    body.ownerTenantId !== null &&
    typeof body.ownerTenantId !== "string"
  ) {
    return NextResponse.json({ error: "Invalid owner organisation." }, { status: 400 });
  }

  const title = hasTitle ? (body.title as string).trim() : undefined;
  const ownerTenantId = hasOwnerTenantId
    ? typeof body.ownerTenantId === "string"
      ? body.ownerTenantId.trim() || null
      : null
    : undefined;

  const exists = await db.assessment.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (ownerTenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: ownerTenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Owner organisation not found." }, { status: 404 });
    }
  }

  let updated;
  try {
    updated = await db.$transaction(async (tx) => {
      const result = await tx.assessment.update({
        where: { id },
        data: {
          ...(title ? { title } : {}),
          ...(hasOwnerTenantId ? { ownerTenantId, tenantId: ownerTenantId } : {}),
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
      await recordAuditLog(
        {
          tenantId: check.liveUser.tenantId,
          actorId: check.liveUser.id,
          action: "ASSESSMENT_UPDATED",
          metadata: {
            assessmentId: id,
            changedFields: [
              ...(hasTitle ? ["title"] : []),
              ...(hasOwnerTenantId ? ["ownerTenantId"] : []),
            ],
          },
        },
        tx,
      );
      return result;
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    updated = await db.$transaction(async (tx) => {
      const legacyUpdated = await tx.assessment.update({
        where: { id },
        data: {
          ...(title ? { title } : {}),
          ...(hasOwnerTenantId && ownerTenantId ? { tenantId: ownerTenantId } : {}),
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
      await recordAuditLog(
        {
          tenantId: check.liveUser.tenantId,
          actorId: check.liveUser.id,
          action: "ASSESSMENT_UPDATED",
          metadata: {
            assessmentId: id,
            changedFields: [
              ...(hasTitle ? ["title"] : []),
              ...(hasOwnerTenantId && ownerTenantId ? ["ownerTenantId"] : []),
            ],
            compatibilityMode: true,
          },
        },
        tx,
      );
      return {
        ...legacyUpdated,
        ownerTenant: legacyUpdated.tenant || null,
        ownerTenantId: legacyUpdated.tenantId,
      };
    });
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

  const result = await db.$transaction(
    async (tx) => {
      const assessment = await tx.assessment.findUnique({
        where: { id },
        select: { id: true, title: true },
      });
      if (!assessment) return { status: "NOT_FOUND" as const };

      const attempt = await tx.quizSession.findFirst({
        where: { assessmentId: id },
        select: { id: true },
      });
      if (attempt) return { status: "HAS_HISTORY" as const };

      await tx.assessment.delete({ where: { id } });
      await recordAuditLog(
        {
          tenantId: check.liveUser.tenantId,
          actorId: check.liveUser.id,
          action: "ASSESSMENT_DELETED",
          metadata: { assessmentId: id, title: assessment.title },
        },
        tx,
      );
      return { status: "DELETED" as const };
    },
    { isolationLevel: "Serializable" },
  );

  if (result.status === "NOT_FOUND") {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }
  if (result.status === "HAS_HISTORY") {
    return NextResponse.json(
      {
        error:
          "This assessment has attempt history and cannot be deleted. Unpublish it instead to preserve historical responses and reports.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    deletedAssessmentId: id,
  });
}
