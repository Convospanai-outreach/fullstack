-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "autoDenyAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ApprovalRequest_tier_autoDenyAt_idx" ON "ApprovalRequest"("tier", "autoDenyAt");
