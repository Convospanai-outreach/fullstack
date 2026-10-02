-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "firstTouchPostId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_teamId_firstTouchPostId_idx" ON "Lead"("teamId", "firstTouchPostId");

