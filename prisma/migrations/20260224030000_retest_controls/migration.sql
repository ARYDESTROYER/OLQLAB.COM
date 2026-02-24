-- CreateTable
CREATE TABLE "RetestEligibility" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL,
    "setByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetestEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportArchive" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedById" TEXT,
    "archiveReason" TEXT,
    "scoreJson" JSONB,
    "narrativeJson" TEXT,
    "assessmentTitle" TEXT,
    "participantName" TEXT,

    CONSTRAINT "ReportArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetestEligibility_assessmentId_userId_key" ON "RetestEligibility"("assessmentId", "userId");

-- CreateIndex
CREATE INDEX "RetestEligibility_assessmentId_idx" ON "RetestEligibility"("assessmentId");

-- CreateIndex
CREATE INDEX "RetestEligibility_userId_idx" ON "RetestEligibility"("userId");

-- CreateIndex
CREATE INDEX "ReportArchive_assessmentId_idx" ON "ReportArchive"("assessmentId");

-- CreateIndex
CREATE INDEX "ReportArchive_userId_idx" ON "ReportArchive"("userId");

-- CreateIndex
CREATE INDEX "ReportArchive_assessmentId_userId_archivedAt_idx" ON "ReportArchive"("assessmentId", "userId", "archivedAt");

-- AddForeignKey
ALTER TABLE "RetestEligibility" ADD CONSTRAINT "RetestEligibility_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetestEligibility" ADD CONSTRAINT "RetestEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportArchive" ADD CONSTRAINT "ReportArchive_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportArchive" ADD CONSTRAINT "ReportArchive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
