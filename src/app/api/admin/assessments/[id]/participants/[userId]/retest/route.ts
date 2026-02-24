import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isMissingTableError } from "@/lib/prisma-errors";

async function validateParticipantScope(assessmentId: string, userId: string) {
  const [assessment, participant] = await Promise.all([
    db.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, tenantId: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, role: true },
    }),
  ]);

  if (!assessment) {
    return {
      error: NextResponse.json({ error: "Assessment not found." }, { status: 404 }),
    };
  }

  if (!participant || participant.tenantId !== assessment.tenantId) {
    return {
      error: NextResponse.json({ error: "Participant not found." }, { status: 404 }),
    };
  }

  if (participant.role === "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Retest controls apply only to employee or leader accounts." },
        { status: 400 },
      ),
    };
  }

  return { assessment, participant };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId, userId } = await params;

  const scope = await validateParticipantScope(assessmentId, userId);
  if ("error" in scope) return scope.error;

  const body = (await req.json().catch(() => null)) as
    | { mode?: "IMMEDIATE" | "DATE"; eligibleAt?: string }
    | null;

  const mode = body?.mode === "DATE" ? "DATE" : "IMMEDIATE";
  let eligibleAt = new Date();

  if (mode === "DATE") {
    const parsed = body?.eligibleAt ? new Date(body.eligibleAt) : new Date(NaN);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "A valid eligibleAt date is required when mode is DATE." },
        { status: 400 },
      );
    }
    eligibleAt = parsed;
  }

  let retestEligibility: { eligibleAt: Date };
  try {
    retestEligibility = await db.retestEligibility.upsert({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
      create: {
        assessmentId,
        userId,
        eligibleAt,
        setByAdminId: check.session.user.id,
      },
      update: {
        eligibleAt,
        setByAdminId: check.session.user.id,
      },
      select: {
        eligibleAt: true,
      },
    });
  } catch (error) {
    if (isMissingTableError(error, "retesteligibility")) {
      return NextResponse.json(
        {
          error:
            "Retest controls are temporarily unavailable because database migrations are incomplete.",
        },
        { status: 503 },
      );
    }
    throw error;
  }

  return NextResponse.json({
    ok: true,
    assessmentId,
    userId,
    mode,
    retestEligibleAt: retestEligibility.eligibleAt,
    canRetestNow: new Date() >= retestEligibility.eligibleAt,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId, userId } = await params;

  const scope = await validateParticipantScope(assessmentId, userId);
  if ("error" in scope) return scope.error;

  try {
    await db.retestEligibility.deleteMany({
      where: {
        assessmentId,
        userId,
      },
    });
  } catch (error) {
    if (isMissingTableError(error, "retesteligibility")) {
      return NextResponse.json(
        {
          error:
            "Retest controls are temporarily unavailable because database migrations are incomplete.",
        },
        { status: 503 },
      );
    }
    throw error;
  }

  return NextResponse.json({
    ok: true,
    assessmentId,
    userId,
    cleared: true,
  });
}
