-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('ORGANIZATION', 'SOLO');

-- CreateEnum
CREATE TYPE "EnrollmentScope" AS ENUM ('USER', 'TENANT');

-- CreateEnum
CREATE TYPE "ReportAccessMode" AS ENUM ('KEEP_APP_ACCESS', 'LINK_ONLY', 'REVOKE');

-- CreateEnum
CREATE TYPE "UnenrollJobStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Tenant"
  ADD COLUMN "type" "TenantType" NOT NULL DEFAULT 'ORGANIZATION',
  ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Assessment"
  ADD COLUMN "ownerTenantId" TEXT,
  ALTER COLUMN "tenantId" DROP NOT NULL;

-- Normalize existing ownership lineage for compatibility.
UPDATE "Assessment"
SET "ownerTenantId" = "tenantId"
WHERE "ownerTenantId" IS NULL;

-- Existing FK was ON DELETE CASCADE; new relationship is lineage-only.
ALTER TABLE "Assessment" DROP CONSTRAINT IF EXISTS "Assessment_tenantId_fkey";
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add owner tenant relation.
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_ownerTenantId_fkey"
  FOREIGN KEY ("ownerTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "OptionImpact"
  ADD COLUMN "assessmentCompetencyId" TEXT,
  ALTER COLUMN "competencyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AssessmentCompetency" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "backfillTag" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentTenantEnrollment" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "includeFutureUsers" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentTenantEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentUserEnrollment" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentUserEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentUnenrollJob" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "targetScope" "EnrollmentScope" NOT NULL,
  "targetId" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "reportMode" "ReportAccessMode" NOT NULL DEFAULT 'KEEP_APP_ACCESS',
  "notifyByEmail" BOOLEAN NOT NULL DEFAULT false,
  "linkTtlHours" INTEGER,
  "status" "UnenrollJobStatus" NOT NULL DEFAULT 'PENDING',
  "executedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentUnenrollJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReportAccessOverride" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" "ReportAccessMode" NOT NULL,
  "sourceJobId" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentReportAccessOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReportShareToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxDownloads" INTEGER NOT NULL DEFAULT 5,
  "downloadsUsed" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMP(3),
  "sourceJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentReportShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assessment_ownerTenantId_idx" ON "Assessment"("ownerTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCompetency_assessmentId_code_key" ON "AssessmentCompetency"("assessmentId", "code");

-- CreateIndex
CREATE INDEX "AssessmentCompetency_assessmentId_idx" ON "AssessmentCompetency"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionImpact_optionId_assessmentCompetencyId_key" ON "OptionImpact"("optionId", "assessmentCompetencyId");

-- CreateIndex
CREATE INDEX "OptionImpact_assessmentCompetencyId_idx" ON "OptionImpact"("assessmentCompetencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTenantEnrollment_assessmentId_tenantId_key" ON "AssessmentTenantEnrollment"("assessmentId", "tenantId");

-- CreateIndex
CREATE INDEX "AssessmentTenantEnrollment_assessmentId_idx" ON "AssessmentTenantEnrollment"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentTenantEnrollment_tenantId_idx" ON "AssessmentTenantEnrollment"("tenantId");

-- CreateIndex
CREATE INDEX "AssessmentTenantEnrollment_assessmentId_active_idx" ON "AssessmentTenantEnrollment"("assessmentId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentUserEnrollment_assessmentId_userId_key" ON "AssessmentUserEnrollment"("assessmentId", "userId");

-- CreateIndex
CREATE INDEX "AssessmentUserEnrollment_assessmentId_idx" ON "AssessmentUserEnrollment"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentUserEnrollment_userId_idx" ON "AssessmentUserEnrollment"("userId");

-- CreateIndex
CREATE INDEX "AssessmentUserEnrollment_assessmentId_active_idx" ON "AssessmentUserEnrollment"("assessmentId", "active");

-- CreateIndex
CREATE INDEX "AssessmentUnenrollJob_assessmentId_idx" ON "AssessmentUnenrollJob"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentUnenrollJob_status_effectiveAt_idx" ON "AssessmentUnenrollJob"("status", "effectiveAt");

-- CreateIndex
CREATE INDEX "AssessmentUnenrollJob_assessmentId_status_idx" ON "AssessmentUnenrollJob"("assessmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentReportAccessOverride_assessmentId_userId_key" ON "AssessmentReportAccessOverride"("assessmentId", "userId");

-- CreateIndex
CREATE INDEX "AssessmentReportAccessOverride_assessmentId_idx" ON "AssessmentReportAccessOverride"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentReportAccessOverride_userId_idx" ON "AssessmentReportAccessOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentReportShareToken_tokenHash_key" ON "AssessmentReportShareToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AssessmentReportShareToken_assessmentId_userId_idx" ON "AssessmentReportShareToken"("assessmentId", "userId");

-- CreateIndex
CREATE INDEX "AssessmentReportShareToken_expiresAt_idx" ON "AssessmentReportShareToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AssessmentCompetency" ADD CONSTRAINT "AssessmentCompetency_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionImpact" ADD CONSTRAINT "OptionImpact_assessmentCompetencyId_fkey"
  FOREIGN KEY ("assessmentCompetencyId") REFERENCES "AssessmentCompetency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTenantEnrollment" ADD CONSTRAINT "AssessmentTenantEnrollment_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTenantEnrollment" ADD CONSTRAINT "AssessmentTenantEnrollment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentUserEnrollment" ADD CONSTRAINT "AssessmentUserEnrollment_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentUserEnrollment" ADD CONSTRAINT "AssessmentUserEnrollment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentUnenrollJob" ADD CONSTRAINT "AssessmentUnenrollJob_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReportAccessOverride" ADD CONSTRAINT "AssessmentReportAccessOverride_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReportAccessOverride" ADD CONSTRAINT "AssessmentReportAccessOverride_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReportAccessOverride" ADD CONSTRAINT "AssessmentReportAccessOverride_sourceJobId_fkey"
  FOREIGN KEY ("sourceJobId") REFERENCES "AssessmentUnenrollJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReportShareToken" ADD CONSTRAINT "AssessmentReportShareToken_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReportShareToken" ADD CONSTRAINT "AssessmentReportShareToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReportShareToken" ADD CONSTRAINT "AssessmentReportShareToken_sourceJobId_fkey"
  FOREIGN KEY ("sourceJobId") REFERENCES "AssessmentUnenrollJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
