-- Existing Invite rows predate durable delivery tracking and represented links
-- that had already left the send endpoint. Preserve them as SENT. New sends set
-- IN_FLIGHT explicitly before leaving the claim transaction.
CREATE TYPE "InviteDeliveryState" AS ENUM ('IN_FLIGHT', 'UNKNOWN', 'SENT');

ALTER TABLE "Invite"
  ADD COLUMN "deliveryState" "InviteDeliveryState" NOT NULL DEFAULT 'SENT',
  ADD COLUMN "deliveryClaimId" TEXT,
  ADD COLUMN "deliveryClaimedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "providerDeliveryId" TEXT;

CREATE INDEX "Invite_tenantId_deliveryState_expiresAt_idx"
  ON "Invite"("tenantId", "deliveryState", "expiresAt");
