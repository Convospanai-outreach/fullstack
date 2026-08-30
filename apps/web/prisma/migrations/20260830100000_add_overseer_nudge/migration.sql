-- CreateTable
CREATE TABLE "OverseerNudge" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "leadId" TEXT,
    "sequenceId" TEXT,
    "enrollmentId" TEXT,
    "stage" TEXT NOT NULL,
    "stallDays" DOUBLE PRECISION NOT NULL,
    "nudgeType" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "actedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverseerNudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OverseerNudge_teamId_status_idx" ON "OverseerNudge"("teamId", "status");

-- CreateIndex
CREATE INDEX "OverseerNudge_enrollmentId_idx" ON "OverseerNudge"("enrollmentId");

-- CreateIndex
CREATE INDEX "OverseerNudge_createdAt_idx" ON "OverseerNudge"("createdAt");

-- AddForeignKey
ALTER TABLE "OverseerNudge" ADD CONSTRAINT "OverseerNudge_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
