import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";

const PREVIEW_TTL_MS = 2 * 60 * 60 * 1000;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const adminId = check.session.user.id;
  const [admin, assessment] = await Promise.all([
    db.user.findUnique({
      where: { id: adminId },
      select: { id: true, tenantId: true },
    }),
    db.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, title: true },
    }),
  ]);

  if (!admin) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!assessment) {
    return NextResponse.json({ error: "Assessment unavailable" }, { status: 404 });
  }

  const now = new Date();
  const id = `preview_${randomUUID()}`;
  const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);

  const preview = await db.$transaction(async (tx) => {
    await tx.assessmentPreviewSession.deleteMany({
      where: { assessmentId, adminId },
    });
    const created = await tx.assessmentPreviewSession.create({
      data: {
        id,
        assessmentId,
        adminId,
        answersJson: {},
        status: "IN_PROGRESS",
        expiresAt,
      },
    });
    await recordAuditLog(
      {
        tenantId: admin.tenantId,
        actorId: admin.id,
        action: "ASSESSMENT_PREVIEW_STARTED",
        metadata: { assessmentId, previewSessionId: created.id, expiresAt },
      },
      tx,
    );
    return created;
  });

  return NextResponse.json({
    sessionId: preview.id,
    previewMode: true,
    expiresAt: preview.expiresAt,
    returnTo: `/admin/assessments/${encodeURIComponent(assessmentId)}`,
  });
}
