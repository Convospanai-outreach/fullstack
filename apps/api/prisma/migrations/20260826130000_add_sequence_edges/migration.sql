-- CreateTable
CREATE TABLE "SequenceEdge" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "sourceStepId" TEXT NOT NULL,
    "targetStepId" TEXT NOT NULL,
    "sourceHandle" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SequenceEdge_sourceStepId_sourceHandle_key" ON "SequenceEdge"("sourceStepId", "sourceHandle");

-- CreateIndex
CREATE INDEX "SequenceEdge_teamId_idx" ON "SequenceEdge"("teamId");

-- CreateIndex
CREATE INDEX "SequenceEdge_sequenceId_idx" ON "SequenceEdge"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceEdge_targetStepId_idx" ON "SequenceEdge"("targetStepId");

-- AddForeignKey
ALTER TABLE "SequenceEdge" ADD CONSTRAINT "SequenceEdge_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEdge" ADD CONSTRAINT "SequenceEdge_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "CampaignSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEdge" ADD CONSTRAINT "SequenceEdge_sourceStepId_fkey" FOREIGN KEY ("sourceStepId") REFERENCES "SequenceStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEdge" ADD CONSTRAINT "SequenceEdge_targetStepId_fkey" FOREIGN KEY ("targetStepId") REFERENCES "SequenceStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No data backfill: a sequence with zero SequenceEdge rows falls back to legacy
-- stepOrder-based linear traversal in sequenceService.ts / sequence-step-worker.ts,
-- so every pre-existing sequence keeps executing exactly as it does today until
-- someone authors real edges for it (via the upcoming graph canvas).
