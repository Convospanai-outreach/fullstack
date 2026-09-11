-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "draftGenerationMode" TEXT NOT NULL DEFAULT 'REALTIME',
ADD COLUMN     "enrichmentPending" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AiDraftBatch" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerBatchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "itemCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "pollAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiDraftBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDraftBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "customId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subject" TEXT,
    "body" TEXT,
    "error" TEXT,

    CONSTRAINT "AiDraftBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiDraftBatch_campaignId_idx" ON "AiDraftBatch"("campaignId");

-- CreateIndex
CREATE INDEX "AiDraftBatch_status_idx" ON "AiDraftBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AiDraftBatchItem_customId_key" ON "AiDraftBatchItem"("customId");

-- CreateIndex
CREATE INDEX "AiDraftBatchItem_batchId_idx" ON "AiDraftBatchItem"("batchId");

-- AddForeignKey
ALTER TABLE "AiDraftBatch" ADD CONSTRAINT "AiDraftBatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDraftBatchItem" ADD CONSTRAINT "AiDraftBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AiDraftBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
