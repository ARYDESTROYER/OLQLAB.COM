-- Reconcile fields that are present in schema.prisma but were not represented
-- by the historical migration chain. The enum/column work is intentionally
-- idempotent because some deployed databases may already contain these objects
-- from an earlier schema-sync workflow.

DO $$
BEGIN
  CREATE TYPE "ReportGenerationMode" AS ENUM ('AUTO', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReportDeliveryMethod" AS ENUM ('DASHBOARD_ONLY', 'EMAIL_LINK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AssessmentTenantEnrollment"
  ADD COLUMN IF NOT EXISTS "reportDelayHours" INTEGER,
  ADD COLUMN IF NOT EXISTS "reportMode" "ReportGenerationMode";

UPDATE "AssessmentTenantEnrollment"
SET
  "reportDelayHours" = COALESCE("reportDelayHours", 0),
  "reportMode" = COALESCE("reportMode", 'AUTO'::"ReportGenerationMode");

ALTER TABLE "AssessmentTenantEnrollment"
  ALTER COLUMN "reportDelayHours" SET DEFAULT 0,
  ALTER COLUMN "reportDelayHours" SET NOT NULL,
  ALTER COLUMN "reportMode" SET DEFAULT 'AUTO',
  ALTER COLUMN "reportMode" SET NOT NULL;

ALTER TABLE "AssessmentUserEnrollment"
  ADD COLUMN IF NOT EXISTS "reportDelayHours" INTEGER,
  ADD COLUMN IF NOT EXISTS "reportMode" "ReportGenerationMode";

UPDATE "AssessmentUserEnrollment"
SET
  "reportDelayHours" = COALESCE("reportDelayHours", 0),
  "reportMode" = COALESCE("reportMode", 'AUTO'::"ReportGenerationMode");

ALTER TABLE "AssessmentUserEnrollment"
  ALTER COLUMN "reportDelayHours" SET DEFAULT 0,
  ALTER COLUMN "reportDelayHours" SET NOT NULL,
  ALTER COLUMN "reportMode" SET DEFAULT 'AUTO',
  ALTER COLUMN "reportMode" SET NOT NULL;

ALTER TABLE "Report"
  ADD COLUMN IF NOT EXISTS "availableAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveryMethod" "ReportDeliveryMethod",
  ADD COLUMN IF NOT EXISTS "status" "ReportStatus",
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "Report"
SET
  "status" = COALESCE("status", 'PUBLISHED'::"ReportStatus"),
  "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP);

ALTER TABLE "Report"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- A short durable lease prevents parallel submit requests from each invoking
-- the report LLM while keeping the database transaction out of the network
-- call. All columns are nullable so existing sessions remain immediately valid.
ALTER TABLE "QuizSession"
  ADD COLUMN IF NOT EXISTS "submissionClaimId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionClaimedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submissionAnswerSnapshotHash" TEXT;

CREATE TABLE IF NOT EXISTS "AssessmentPreviewSession" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "answersJson" JSONB NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AssessmentPreviewSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuthRateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "AssessmentPreviewSession_adminId_expiresAt_idx"
  ON "AssessmentPreviewSession"("adminId", "expiresAt");

CREATE INDEX IF NOT EXISTS "AssessmentPreviewSession_expiresAt_idx"
  ON "AssessmentPreviewSession"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentPreviewSession_assessmentId_adminId_key"
  ON "AssessmentPreviewSession"("assessmentId", "adminId");

CREATE INDEX IF NOT EXISTS "AuthRateLimitBucket_resetAt_idx"
  ON "AuthRateLimitBucket"("resetAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AssessmentPreviewSession_assessmentId_fkey'
  ) THEN
    ALTER TABLE "AssessmentPreviewSession"
      ADD CONSTRAINT "AssessmentPreviewSession_assessmentId_fkey"
      FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AssessmentPreviewSession_adminId_fkey'
  ) THEN
    ALTER TABLE "AssessmentPreviewSession"
      ADD CONSTRAINT "AssessmentPreviewSession_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Bind every new share token to one concrete report generation. Legacy rows
-- did not record an attempt/report generation, so attaching them to today's
-- report could revive an old-attempt URL. Remove those ambiguous rows instead.
ALTER TABLE "AssessmentReportShareToken"
  ADD COLUMN IF NOT EXISTS "reportId" TEXT;

DELETE FROM "AssessmentReportShareToken"
WHERE "reportId" IS NULL;

ALTER TABLE "AssessmentReportShareToken"
  ALTER COLUMN "reportId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AssessmentReportShareToken_reportId_idx"
  ON "AssessmentReportShareToken"("reportId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AssessmentReportShareToken_reportId_fkey'
  ) THEN
    ALTER TABLE "AssessmentReportShareToken"
      ADD CONSTRAINT "AssessmentReportShareToken_reportId_fkey"
      FOREIGN KEY ("reportId") REFERENCES "Report"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
