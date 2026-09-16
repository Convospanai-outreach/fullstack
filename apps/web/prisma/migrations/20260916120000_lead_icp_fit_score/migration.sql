-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "icpFitScore" INTEGER;

-- CreateIndex
CREATE INDEX "Lead_icpFitScore_idx" ON "Lead"("icpFitScore");
