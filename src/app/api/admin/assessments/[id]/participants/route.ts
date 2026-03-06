import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isMissingTableError, isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { listResolvedAssessmentUsers } from "@/lib/assessment-access";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function listParticipants(assessmentId: string, q?: string) {
  const users = await listResolvedAssessmentUsers(assessmentId, q);
  const userIds = users.map((user) => user.userId);

  const sessions = userIds.length
    ? await db.quizSession.findMany({
        where: {
          assessmentId,
          userId: { in: userIds },
        },
        select: {
          userId: true,
          status: true,
          startedAt: true,
          submittedAt: true,
        },
      })
    : [];

  const reports = userIds.length
    ? await db.report.findMany({
        where: {
          assessmentId,
          userId: { in: userIds },
        },
      select: {
        id: true,
        userId: true,
        status: true,
        availableAt: true,
        deliveryMethod: true,
        pdfAsset: {
          select: {
            id: true,
          },
        },
      },
    })
    : [];

  let retestEligibility: Array<{ userId: string; eligibleAt: Date }> = [];
  if (userIds.length) {
    try {
      retestEligibility = await db.retestEligibility.findMany({
        where: {
          assessmentId,
          userId: { in: userIds },
        },
        select: {
          userId: true,
          eligibleAt: true,
        },
      });
    } catch (error) {
      if (!isMissingTableError(error, "retesteligibility")) throw error;
      retestEligibility = [];
    }
  }

  const sessionByUser = new Map(sessions.map((session) => [session.userId, session]));
  const reportByUser = new Map(reports.map((report) => [report.userId, report]));
  const retestByUser = new Map(
    retestEligibility.map((item) => [item.userId, item.eligibleAt]),
  );
  const now = new Date();

  return users.map((user) => {
    const userSession = sessionByUser.get(user.userId);
    const userReport = reportByUser.get(user.userId);
    const retestEligibleAt = retestByUser.get(user.userId) || null;
    const canRetestNow = retestEligibleAt ? now >= retestEligibleAt : false;

    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      managerEmail: user.managerEmail,
      status: userSession?.status || "NOT_STARTED",
      startedAt: userSession?.startedAt || null,
      submittedAt: userSession?.submittedAt || null,
      reportId: userReport?.id || null,
      reportStatus: userReport?.status || null,
      reportAvailableAt: userReport?.availableAt || null,
      reportDeliveryMethod: userReport?.deliveryMethod || null,
      hasManualPdf: Boolean(userReport?.pdfAsset),
      retestEligibleAt,
      canRetestNow,
      sources: user.sources,
    };
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  const participants = await listParticipants(assessmentId, q);
  return NextResponse.json({ participants });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        userId?: string;
        tenantId?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: "EMPLOYEE" | "LEADER";
        managerEmail?: string;
      }
    | null;

  let assessment: { id: string; ownerTenantId: string | null } | null = null;
  try {
    assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        ownerTenantId: true,
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacy = await db.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        tenantId: true,
      },
    });
    assessment = legacy
      ? {
          id: legacy.id,
          ownerTenantId: legacy.tenantId,
        }
      : null;
  }

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  let userId = body?.userId?.trim();

  if (!userId) {
    const email = body?.email ? normalizeEmail(body.email) : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Either userId or a valid participant email is required." },
        { status: 400 },
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true, role: true },
    });

    if (existingUser?.role === "ADMIN") {
      return NextResponse.json(
        { error: "Admin users cannot be enrolled as participants." },
        { status: 400 },
      );
    }

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const tenantId = body?.tenantId?.trim() || assessment.ownerTenantId;
      if (!tenantId) {
        return NextResponse.json(
          {
            error:
              "This assessment has no owner tenant. Create the user first from Users admin and enroll by userId.",
          },
          { status: 400 },
        );
      }

      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          seatLimit: true,
        },
      });

      if (!tenant) {
        return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
      }

      const seatCount = await db.seat.count({ where: { tenantId } });
      if (seatCount >= tenant.seatLimit) {
        return NextResponse.json(
          {
            error: `Seat limit reached (${tenant.seatLimit}). Increase seats before adding more users.`,
          },
          { status: 400 },
        );
      }

      const manager = body?.managerEmail
        ? await db.user.findFirst({
            where: {
              tenantId,
              email: normalizeEmail(body.managerEmail),
            },
            select: {
              id: true,
            },
          })
        : null;

      const role = body?.role === "LEADER" ? "LEADER" : "EMPLOYEE";
      const createdUser = await db.user.create({
        data: {
          email,
          firstName: body?.firstName?.trim() || "Participant",
          lastName: body?.lastName?.trim() || "User",
          role,
          tenantId,
          managerId: manager?.id,
        },
        select: {
          id: true,
        },
      });

      await db.seat.upsert({
        where: {
          tenantId_userEmail: {
            tenantId,
            userEmail: email,
          },
        },
        create: {
          tenantId,
          userEmail: email,
          assigned: false,
        },
        update: {
          assigned: false,
        },
      });

      userId = createdUser.id;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Unable to resolve participant user." }, { status: 500 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Target participant is invalid." },
      { status: 400 },
    );
  }

  try {
    await db.assessmentUserEnrollment.upsert({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
      create: {
        assessmentId,
        userId,
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
  }

  const [participants] = await Promise.all([
    listParticipants(assessmentId),
    (async () => {
      try {
        await db.assessmentReportAccessOverride.deleteMany({
          where: {
            assessmentId,
            userId,
          },
        });
      } catch (error) {
        if (!isSchemaCompatibilityError(error)) throw error;
      }
    })(),
  ]);

  const participant = participants.find((item) => item.userId === userId) || null;

  return NextResponse.json({
    ok: true,
    assessmentId,
    participant,
  });
}
