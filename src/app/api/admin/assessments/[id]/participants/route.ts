import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { isMissingTableError, isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { listResolvedAssessmentUsers } from "@/lib/assessment-access";
import { IdentityPolicyError } from "@/lib/identity-policy";
import {
  hasTenantSeatCapacity,
  lockTenantSeatInventory,
} from "@/lib/tenant-seat-lock";
import { cancelOutstandingUnenrollJobs } from "@/lib/unenroll-jobs";

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

  const requestedUserId = body?.userId?.trim();
  const email = body?.email ? normalizeEmail(body.email) : "";
  if (!requestedUserId && (!email || !email.includes("@"))) {
    return NextResponse.json(
      { error: "Either userId or a valid participant email is required." },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    userId = await db.$transaction(
      async (tx) => {
        const liveAssessment = await tx.assessment.findUnique({
          where: { id: assessmentId },
          select: { id: true },
        });
        if (!liveAssessment) {
          throw new IdentityPolicyError(
            "ASSESSMENT_NOT_FOUND",
            "Assessment not found.",
            404,
          );
        }

        let user = requestedUserId
          ? await tx.user.findUnique({
              where: { id: requestedUserId },
              select: { id: true, role: true, tenantId: true },
            })
          : await tx.user.findUnique({
              where: { email },
              select: { id: true, role: true, tenantId: true },
            });

        let createdUser = false;
        if (!user && !requestedUserId) {
          const tenantId = body?.tenantId?.trim() || assessment.ownerTenantId;
          if (!tenantId) {
            throw new IdentityPolicyError(
              "ORGANISATION_REQUIRED",
              "This assessment has no owner organisation. Create the user first from Users admin and enroll by userId.",
            );
          }

          await lockTenantSeatInventory(tx, tenantId);
          // A concurrent request can create the email while this request waits
          // for the tenant inventory lock. Re-read before reserving a seat.
          user = await tx.user.findUnique({
            where: { email },
            select: { id: true, role: true, tenantId: true },
          });

          if (!user) {
            const tenant = await tx.tenant.findUnique({
              where: { id: tenantId },
              select: {
                id: true,
                type: true,
                isArchived: true,
                seatLimit: true,
              },
            });
            if (!tenant) {
              throw new IdentityPolicyError(
                "ORGANISATION_NOT_FOUND",
                "Organisation not found.",
                404,
              );
            }
            if (tenant.type !== "ORGANIZATION" || tenant.isArchived) {
              throw new IdentityPolicyError(
                "ORGANISATION_UNAVAILABLE",
                "Participants can only be created in an active Organisation.",
                409,
              );
            }

            const managerEmail = body?.managerEmail?.trim();
            const manager = managerEmail
              ? await tx.user.findFirst({
                  where: {
                    tenantId,
                    email: normalizeEmail(managerEmail),
                    role: "LEADER",
                  },
                  select: { id: true },
                })
              : null;
            if (managerEmail && !manager) {
              throw new IdentityPolicyError(
                "MANAGER_NOT_FOUND",
                "Manager must be an existing Leader in the same Organisation.",
              );
            }

            const [seatCount, existingSeat] = await Promise.all([
              tx.seat.count({ where: { tenantId } }),
              tx.seat.findUnique({
                where: {
                  tenantId_userEmail: { tenantId, userEmail: email },
                },
                select: { id: true },
              }),
            ]);
            if (
              !hasTenantSeatCapacity({
                seatLimit: tenant.seatLimit,
                currentSeatCount: seatCount,
                hasExistingSeat: Boolean(existingSeat),
              })
            ) {
              throw new IdentityPolicyError(
                "SEAT_LIMIT_REACHED",
                `Seat limit reached (${tenant.seatLimit}). Increase seats before adding more users.`,
                409,
              );
            }

            await tx.seat.upsert({
              where: {
                tenantId_userEmail: { tenantId, userEmail: email },
              },
              create: { tenantId, userEmail: email, assigned: false },
              update: { assigned: false },
            });
            user = await tx.user.create({
              data: {
                email,
                firstName: body?.firstName?.trim() || "Participant",
                lastName: body?.lastName?.trim() || "User",
                role: body?.role === "LEADER" ? "LEADER" : "EMPLOYEE",
                tenantId,
                managerId: manager?.id,
              },
              select: { id: true, role: true, tenantId: true },
            });
            createdUser = true;
          }
        }

        if (!user) {
          throw new IdentityPolicyError(
            "PARTICIPANT_NOT_FOUND",
            "Target participant is invalid.",
            404,
          );
        }
        if (user.role === "ADMIN") {
          throw new IdentityPolicyError(
            "TARGET_NOT_PARTICIPANT",
            "Admin users cannot be enrolled as participants.",
          );
        }

        const enrollment = await tx.assessmentUserEnrollment.upsert({
          where: {
            assessmentId_userId: { assessmentId, userId: user.id },
          },
          create: {
            assessmentId,
            userId: user.id,
            active: true,
            createdByAdminId: check.liveUser.id,
          },
          update: { active: true, createdByAdminId: check.liveUser.id },
        });
        const cancellation = await cancelOutstandingUnenrollJobs(tx, {
          assessmentId,
          targetScope: "USER",
          targetId: user.id,
        });
        const clearedOverrides = await tx.assessmentReportAccessOverride.deleteMany({
          where: { assessmentId, userId: user.id },
        });
        await recordAuditLog(
          {
            tenantId: user.tenantId,
            actorId: check.liveUser.id,
            action: "assessment.participant_enrolled",
            metadata: {
              assessmentId,
              userId: user.id,
              enrollmentId: enrollment.id,
              createdUser,
              clearedOverrides: clearedOverrides.count,
              ...cancellation,
            },
          },
          tx,
        );
        return user.id;
      },
      {
        // The tenant advisory lock serializes capacity checks. READ COMMITTED
        // ensures the post-lock re-read observes the transaction that released it.
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  } catch (error) {
    if (error instanceof IdentityPolicyError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return NextResponse.json(
        {
          error: "Participant state changed concurrently. Please retry.",
          code: "PARTICIPANT_CONFLICT",
        },
        { status: 409 },
      );
    }
    if (isSchemaCompatibilityError(error)) {
      return NextResponse.json(
        { error: "Database migration required for participant enrollment." },
        { status: 409 },
      );
    }
    throw error;
  }

  const participants = await listParticipants(assessmentId);

  const participant = participants.find((item) => item.userId === userId) || null;

  return NextResponse.json({
    ok: true,
    assessmentId,
    participant,
  });
}
