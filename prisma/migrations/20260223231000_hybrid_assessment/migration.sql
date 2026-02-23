-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('PERSONALITY', 'SCENARIO');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('LIKERT_TRAIT', 'SJT_SINGLE');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "category" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "questionType" "QuestionType" NOT NULL DEFAULT 'LIKERT_TRAIT',
ADD COLUMN     "scaleMax" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "scaleMin" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sectionId" TEXT,
ALTER COLUMN "trait" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "optionId" TEXT,
ALTER COLUMN "value" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "competencyJson" JSONB;

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSection" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "SectionKind" NOT NULL DEFAULT 'PERSONALITY',
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "AssessmentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionImpact" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OptionImpact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competency_tenantId_idx" ON "Competency"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_tenantId_code_key" ON "Competency"("tenantId", "code");

-- CreateIndex
CREATE INDEX "AssessmentSection_assessmentId_idx" ON "AssessmentSection"("assessmentId");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_idx" ON "QuestionOption"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_code_key" ON "QuestionOption"("questionId", "code");

-- CreateIndex
CREATE INDEX "OptionImpact_optionId_idx" ON "OptionImpact"("optionId");

-- CreateIndex
CREATE INDEX "OptionImpact_competencyId_idx" ON "OptionImpact"("competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionImpact_optionId_competencyId_key" ON "OptionImpact"("optionId", "competencyId");

-- CreateIndex
CREATE INDEX "Question_sectionId_idx" ON "Question"("sectionId");

-- CreateIndex
CREATE INDEX "Answer_optionId_idx" ON "Answer"("optionId");

-- AddForeignKey
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSection" ADD CONSTRAINT "AssessmentSection_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "AssessmentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionImpact" ADD CONSTRAINT "OptionImpact_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuestionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionImpact" ADD CONSTRAINT "OptionImpact_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuestionOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

