-- CreateEnum
CREATE TYPE "ReportWorkflow" AS ENUM ('AI_STANDARD', 'MANUAL_PDF_UPLOAD');

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'FREE_TEXT';

-- AlterTable
ALTER TABLE "AssessmentPolicy"
ADD COLUMN "reportWorkflow" "ReportWorkflow" NOT NULL DEFAULT 'AI_STANDARD',
ADD COLUMN "randomizeQuestionOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "submissionAlertAdminIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Answer"
ADD COLUMN "textValue" TEXT;

-- CreateTable
CREATE TABLE "ReportPdfAsset" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pdfBytes" BYTEA NOT NULL,
    "uploadedByAdminId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportPdfAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportPdfAsset_reportId_key" ON "ReportPdfAsset"("reportId");

-- CreateIndex
CREATE INDEX "ReportPdfAsset_uploadedByAdminId_idx" ON "ReportPdfAsset"("uploadedByAdminId");

-- AddForeignKey
ALTER TABLE "ReportPdfAsset" ADD CONSTRAINT "ReportPdfAsset_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPdfAsset" ADD CONSTRAINT "ReportPdfAsset_uploadedByAdminId_fkey" FOREIGN KEY ("uploadedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
