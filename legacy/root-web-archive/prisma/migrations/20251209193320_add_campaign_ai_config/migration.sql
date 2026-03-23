-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "aiConfig" JSONB,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'standard';
