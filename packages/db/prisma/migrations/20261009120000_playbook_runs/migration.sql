-- AlterTable
ALTER TABLE "ContentPost" ADD COLUMN     "channelCaptions" JSONB,
ADD COLUMN     "playbookRunId" TEXT,
ADD COLUMN     "visualBrief" TEXT;

-- CreateTable
CREATE TABLE "PlaybookRun" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "error" TEXT,
    "inputs" JSONB NOT NULL,
    "productId" TEXT,
    "bookingUrl" TEXT,
    "icpId" TEXT,
    "icpCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybookRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaybookRun_teamId_createdAt_idx" ON "PlaybookRun"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentPost_playbookRunId_idx" ON "ContentPost"("playbookRunId");

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_playbookRunId_fkey" FOREIGN KEY ("playbookRunId") REFERENCES "PlaybookRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookRun" ADD CONSTRAINT "PlaybookRun_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookRun" ADD CONSTRAINT "PlaybookRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookRun" ADD CONSTRAINT "PlaybookRun_icpId_fkey" FOREIGN KEY ("icpId") REFERENCES "ICP"("id") ON DELETE SET NULL ON UPDATE CASCADE;

