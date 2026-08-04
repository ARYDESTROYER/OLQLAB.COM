-- A report row can be unpublished, edited, and republished. Bind share links to
-- one explicit publication generation so an old URL cannot expose replacement
-- content merely because the Report id stayed the same.
ALTER TABLE "Report"
  ADD COLUMN IF NOT EXISTS "publicationGeneration" INTEGER NOT NULL DEFAULT 0;

UPDATE "Report"
SET "publicationGeneration" = 1
WHERE "status" = 'PUBLISHED'::"ReportStatus"
  AND "publicationGeneration" = 0;

ALTER TABLE "AssessmentReportShareToken"
  ADD COLUMN IF NOT EXISTS "publicationVersionKey" TEXT;

-- Existing rows predate publication binding. They cannot safely be associated
-- with the content generation that their plaintext URL originally exposed.
UPDATE "AssessmentReportShareToken"
SET
  "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
  "publicationVersionKey" = COALESCE(
    "publicationVersionKey",
    'legacy-revoked:' || "id"
  );

ALTER TABLE "AssessmentReportShareToken"
  ALTER COLUMN "publicationVersionKey" SET NOT NULL;
