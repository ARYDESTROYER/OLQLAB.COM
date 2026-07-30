import crypto from "node:crypto";
import { addDays } from "date-fns";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { sendEmailOrThrow } from "@/lib/resend";
import { getEnv } from "@/lib/env";
import { recordAuditLog } from "@/lib/audit-log";
import {
  buildInviteDeliveryResult,
  classifySkippedInviteSeat,
  getInviteDeliveryStaleBefore,
  shouldReleaseInviteReservation,
  type SkippedInviteSeat,
} from "@/lib/invite-delivery";

const INVITE_BATCH_SIZE = 20;
const SKIPPED_SEAT_SAMPLE_SIZE = 20;

type InvitableSeatRow = {
  id: string;
  userEmail: string;
};

type RetryableInviteRow = {
  id: string;
  email: string;
  deliveryAttemptCount: number;
};

type InviteReservation = {
  id: string;
  email: string;
  claimId: string;
  attemptNumber: number;
  replay: boolean;
};

type SkippedSeatRow = {
  userEmail: string;
  userId: string | null;
  userTenantId: string | null;
  role: "ADMIN" | "EMPLOYEE" | "LEADER" | null;
  totalCount: number;
};

class InviteStateError extends Error {
  constructor(
    readonly code: "ORGANISATION_NOT_FOUND" | "ORGANISATION_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "InviteStateError";
  }
}

async function lockTenantInviteBatch(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext(${`olq-invite-batch:${tenantId}`})
    ) IS NULL AS "lockResult"
  `);
}

async function reserveInviteBatch(input: {
  tenantId: string;
  actorId: string;
  now: Date;
}) {
  return db.$transaction(
    async (tx) => {
      await lockTenantInviteBatch(tx, input.tenantId);

      const tenant = await tx.tenant.findUnique({
        where: { id: input.tenantId },
        select: { id: true, type: true, isArchived: true },
      });
      if (!tenant) {
        throw new InviteStateError(
          "ORGANISATION_NOT_FOUND",
          "Organisation not found.",
        );
      }
      if (tenant.type !== "ORGANIZATION" || tenant.isArchived) {
        throw new InviteStateError(
          "ORGANISATION_UNAVAILABLE",
          "Invites can only be sent for an active Organisation.",
        );
      }

      await tx.invite.deleteMany({
        where: {
          tenantId: input.tenantId,
          acceptedAt: null,
          expiresAt: { lte: input.now },
        },
      });
      const staleBefore = getInviteDeliveryStaleBefore(input.now);
      const retryableInvites = await tx.$queryRaw<RetryableInviteRow[]>(Prisma.sql`
        SELECT
          invite."id",
          invite."email",
          invite."deliveryAttemptCount"
        FROM "Invite" invite
        INNER JOIN "Seat" seat
          ON seat."tenantId" = invite."tenantId"
          AND seat."userEmail" = invite."email"
        INNER JOIN "User" participant
          ON participant."email" = seat."userEmail"
          AND participant."tenantId" = seat."tenantId"
        WHERE invite."tenantId" = ${input.tenantId}
          AND invite."acceptedAt" IS NULL
          AND invite."expiresAt" > ${input.now}
          AND seat."assigned" = false
          AND participant."role" IN ('EMPLOYEE'::"Role", 'LEADER'::"Role")
          AND (
            invite."deliveryState" = 'UNKNOWN'::"InviteDeliveryState"
            OR (
              invite."deliveryState" = 'IN_FLIGHT'::"InviteDeliveryState"
              AND (
                invite."deliveryClaimedAt" IS NULL
                OR invite."deliveryClaimedAt" <= ${staleBefore}
              )
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "Invite" delivered
            WHERE delivered."tenantId" = invite."tenantId"
              AND delivered."email" = invite."email"
              AND delivered."id" <> invite."id"
              AND delivered."acceptedAt" IS NULL
              AND delivered."expiresAt" > ${input.now}
              AND delivered."deliveryState" = 'SENT'::"InviteDeliveryState"
          )
        ORDER BY
          CASE invite."deliveryState"
            WHEN 'UNKNOWN'::"InviteDeliveryState" THEN 0
            ELSE 1
          END,
          invite."createdAt" ASC,
          invite."id" ASC
        LIMIT ${INVITE_BATCH_SIZE}
        FOR UPDATE OF invite SKIP LOCKED
      `);

      const reservations: InviteReservation[] = [];
      for (const invite of retryableInvites) {
        const claimId = crypto.randomUUID();
        const claimed = await tx.invite.updateMany({
          where: {
            id: invite.id,
            acceptedAt: null,
            expiresAt: { gt: input.now },
            OR: [
              { deliveryState: "UNKNOWN" },
              {
                deliveryState: "IN_FLIGHT",
                OR: [
                  { deliveryClaimedAt: null },
                  { deliveryClaimedAt: { lte: staleBefore } },
                ],
              },
            ],
          },
          data: {
            deliveryState: "IN_FLIGHT",
            deliveryClaimId: claimId,
            deliveryClaimedAt: input.now,
            deliveryAttemptCount: { increment: 1 },
          },
        });
        if (claimed.count !== 1) continue;

        const attemptNumber = Number(invite.deliveryAttemptCount) + 1;
        await recordAuditLog(
          {
            tenantId: input.tenantId,
            actorId: input.actorId,
            action: "admin.invite.delivery_attempted",
            metadata: {
              inviteId: invite.id,
              email: invite.email,
              claimId,
              attemptNumber,
              replay: true,
            },
          },
          tx,
        );
        reservations.push({
          id: invite.id,
          email: invite.email,
          claimId,
          attemptNumber,
          replay: true,
        });
      }

      const freshLimit = INVITE_BATCH_SIZE - reservations.length;
      const seats =
        freshLimit > 0
          ? await tx.$queryRaw<InvitableSeatRow[]>(Prisma.sql`
              SELECT seat."id", seat."userEmail"
              FROM "Seat" seat
              INNER JOIN "User" participant
                ON participant."email" = seat."userEmail"
                AND participant."tenantId" = seat."tenantId"
              WHERE seat."tenantId" = ${input.tenantId}
                AND seat."assigned" = false
                AND participant."role" IN ('EMPLOYEE'::"Role", 'LEADER'::"Role")
                AND NOT EXISTS (
                  SELECT 1
                  FROM "Invite" invite
                  WHERE invite."tenantId" = seat."tenantId"
                    AND invite."email" = seat."userEmail"
                    AND invite."acceptedAt" IS NULL
                    AND invite."expiresAt" > ${input.now}
                )
              ORDER BY seat."createdAt" ASC, seat."id" ASC
              LIMIT ${freshLimit}
            `)
          : [];
      const skippedRows = await tx.$queryRaw<SkippedSeatRow[]>(Prisma.sql`
        SELECT
          seat."userEmail",
          participant."id" AS "userId",
          participant."tenantId" AS "userTenantId",
          participant."role"::text AS "role",
          (COUNT(*) OVER())::integer AS "totalCount"
        FROM "Seat" seat
        LEFT JOIN "User" participant ON participant."email" = seat."userEmail"
        WHERE seat."tenantId" = ${input.tenantId}
          AND seat."assigned" = false
          AND (
            participant."id" IS NULL
            OR participant."tenantId" <> seat."tenantId"
            OR participant."role" = 'ADMIN'::"Role"
          )
        ORDER BY seat."createdAt" ASC, seat."id" ASC
        LIMIT ${SKIPPED_SEAT_SAMPLE_SIZE}
      `);
      const skipped: SkippedInviteSeat[] = skippedRows.map((seat) =>
        classifySkippedInviteSeat({
          email: seat.userEmail,
          userId: seat.userId,
          userTenantId: seat.userTenantId,
          seatTenantId: input.tenantId,
          role: seat.role,
        }),
      );
      const skippedCount = Number(skippedRows[0]?.totalCount || 0);

      if (skippedCount > 0) {
        await recordAuditLog(
          {
            tenantId: input.tenantId,
            actorId: input.actorId,
            action: "admin.invite.seats_skipped",
            metadata: {
              skippedCount,
              sampledSeats: skipped,
            },
          },
          tx,
        );
      }

      for (const seat of seats) {
        const claimId = crypto.randomUUID();
        const invite = await tx.invite.create({
          data: {
            tenantId: input.tenantId,
            email: seat.userEmail,
            token: crypto.randomBytes(24).toString("hex"),
            expiresAt: addDays(input.now, 7),
            deliveryState: "IN_FLIGHT",
            deliveryClaimId: claimId,
            deliveryClaimedAt: input.now,
            deliveryAttemptCount: 1,
          },
          select: { id: true, email: true },
        });
        await recordAuditLog(
          {
            tenantId: input.tenantId,
            actorId: input.actorId,
            action: "admin.invite.delivery_attempted",
            metadata: {
              inviteId: invite.id,
              email: invite.email,
              claimId,
              attemptNumber: 1,
              replay: false,
            },
          },
          tx,
        );
        reservations.push({
          ...invite,
          claimId,
          attemptNumber: 1,
          replay: false,
        });
      }

      return { reservations, skipped, skippedCount };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}

async function countRemainingInviteCandidates(tenantId: string, now: Date) {
  const staleBefore = getInviteDeliveryStaleBefore(now);
  return db.$transaction(
    async (tx) => {
      await lockTenantInviteBatch(tx, tenantId);
      const rows = await tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::integer AS "count"
        FROM "Seat" seat
        INNER JOIN "User" participant
          ON participant."email" = seat."userEmail"
          AND participant."tenantId" = seat."tenantId"
        WHERE seat."tenantId" = ${tenantId}
          AND seat."assigned" = false
          AND participant."role" IN ('EMPLOYEE'::"Role", 'LEADER'::"Role")
          AND (
            NOT EXISTS (
              SELECT 1
              FROM "Invite" invite
              WHERE invite."tenantId" = seat."tenantId"
                AND invite."email" = seat."userEmail"
                AND invite."acceptedAt" IS NULL
                AND invite."expiresAt" > ${now}
            )
            OR EXISTS (
              SELECT 1
              FROM "Invite" retryable
              WHERE retryable."tenantId" = seat."tenantId"
                AND retryable."email" = seat."userEmail"
                AND retryable."acceptedAt" IS NULL
                AND retryable."expiresAt" > ${now}
                AND (
                  retryable."deliveryState" = 'UNKNOWN'::"InviteDeliveryState"
                  OR (
                    retryable."deliveryState" = 'IN_FLIGHT'::"InviteDeliveryState"
                    AND (
                      retryable."deliveryClaimedAt" IS NULL
                      OR retryable."deliveryClaimedAt" <= ${staleBefore}
                    )
                  )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM "Invite" delivered
                  WHERE delivered."tenantId" = retryable."tenantId"
                    AND delivered."email" = retryable."email"
                    AND delivered."id" <> retryable."id"
                    AND delivered."acceptedAt" IS NULL
                    AND delivered."expiresAt" > ${now}
                    AND delivered."deliveryState" = 'SENT'::"InviteDeliveryState"
                )
            )
          )
      `);
      return Number(rows[0]?.count || 0);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = (await req.json().catch(() => null)) as { tenantId?: string } | null;
  const tenantId = body?.tenantId?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "Organisation is required." }, { status: 400 });
  }

  const now = new Date();
  let batch: Awaited<ReturnType<typeof reserveInviteBatch>>;
  try {
    batch = await reserveInviteBatch({
      tenantId,
      actorId: check.liveUser.id,
      now,
    });
  } catch (error) {
    if (error instanceof InviteStateError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "ORGANISATION_NOT_FOUND" ? 404 : 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Another invite batch is being prepared. Please retry." },
        { status: 409 },
      );
    }
    throw error;
  }

  const env = getEnv();
  const failed: Array<{ email: string }> = [];
  const auditWarnings: Array<{ email: string }> = [];
  let sent = 0;

  for (const invite of batch.reservations) {
    const signInUrl = `${env.NEXTAUTH_URL}/signin?email=${encodeURIComponent(invite.email)}`;
    let deliveryId: string;
    try {
      const delivery = await sendEmailOrThrow(
        {
          from: env.EMAIL_FROM,
          to: invite.email,
          subject: "You are invited to complete your personality assessment",
          html: `<p>You are invited to complete your assessment.</p><p><a href="${signInUrl}">Start</a></p>`,
        },
        { idempotencyKey: `invite:${invite.id}` },
      );
      deliveryId = delivery.id;
      sent += 1;
    } catch (error) {
      console.error("Invite delivery failed.", error);
      failed.push({ email: invite.email });
      const releaseReservation = shouldReleaseInviteReservation(error);
      try {
        await db.$transaction(async (tx) => {
          const transition = releaseReservation
            ? await tx.invite.deleteMany({
                where: {
                  id: invite.id,
                  deliveryState: "IN_FLIGHT",
                  deliveryClaimId: invite.claimId,
                },
              })
            : await tx.invite.updateMany({
                where: {
                  id: invite.id,
                  deliveryState: "IN_FLIGHT",
                  deliveryClaimId: invite.claimId,
                },
                data: {
                  deliveryState: "UNKNOWN",
                  deliveryClaimId: null,
                  deliveryClaimedAt: null,
                },
              });
          await recordAuditLog(
            {
              tenantId,
              actorId: check.liveUser.id,
              action: "admin.invite.delivery_failed",
              metadata: {
                inviteId: invite.id,
                email: invite.email,
                claimId: invite.claimId,
                attemptNumber: invite.attemptNumber,
                replay: invite.replay,
                deliveryState: releaseReservation
                  ? "DEFINITIVE_REJECTION"
                  : "DELIVERY_UNKNOWN",
                transitionApplied: transition.count === 1,
                reservationReleased:
                  releaseReservation && transition.count === 1,
              },
            },
            tx,
          );
        });
      } catch (cleanupError) {
        console.error("Invite failure audit handling failed.", cleanupError);
        if (releaseReservation) {
          await db.invite.deleteMany({
            where: {
              id: invite.id,
              deliveryState: "IN_FLIGHT",
              deliveryClaimId: invite.claimId,
            },
          });
        } else {
          await db.invite.updateMany({
            where: {
              id: invite.id,
              deliveryState: "IN_FLIGHT",
              deliveryClaimId: invite.claimId,
            },
            data: {
              deliveryState: "UNKNOWN",
              deliveryClaimId: null,
              deliveryClaimedAt: null,
            },
          });
        }
      }
      continue;
    }

    try {
      await db.$transaction(async (tx) => {
        const transition = await tx.invite.updateMany({
          where: {
            id: invite.id,
            deliveryState: "IN_FLIGHT",
            deliveryClaimId: invite.claimId,
          },
          data: {
            deliveryState: "SENT",
            deliveryClaimId: null,
            deliveryClaimedAt: null,
            providerDeliveryId: deliveryId,
          },
        });
        await recordAuditLog(
          {
            tenantId,
            actorId: check.liveUser.id,
            action: "admin.invite.sent",
            metadata: {
              inviteId: invite.id,
              email: invite.email,
              claimId: invite.claimId,
              attemptNumber: invite.attemptNumber,
              replay: invite.replay,
              deliveryId,
              transitionApplied: transition.count === 1,
            },
          },
          tx,
        );
      });
    } catch (error) {
      // The provider already succeeded. Persist SENT without the audit record so
      // a transient audit failure cannot cause an unnecessary replay.
      console.error("Invite delivery state/audit failed after send.", error);
      auditWarnings.push({ email: invite.email });
      await db.invite.updateMany({
        where: {
          id: invite.id,
          deliveryState: "IN_FLIGHT",
          deliveryClaimId: invite.claimId,
        },
        data: {
          deliveryState: "SENT",
          deliveryClaimId: null,
          deliveryClaimedAt: null,
          providerDeliveryId: deliveryId,
        },
      });
    }
  }

  const remaining = await countRemainingInviteCandidates(tenantId, new Date());
  const result = buildInviteDeliveryResult({
    attempted: batch.reservations.length,
    sent,
    failed,
    remaining,
    auditWarnings,
    skipped: batch.skipped,
    skippedCount: batch.skippedCount,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
