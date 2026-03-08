-- CreateEnum
CREATE TYPE "AssessmentQuestionPresentationMode" AS ENUM ('ALL_AT_ONCE', 'ONE_AT_A_TIME');

-- AlterTable
ALTER TABLE "AssessmentPolicy"
ADD COLUMN "questionPresentationMode" "AssessmentQuestionPresentationMode" NOT NULL DEFAULT 'ALL_AT_ONCE';