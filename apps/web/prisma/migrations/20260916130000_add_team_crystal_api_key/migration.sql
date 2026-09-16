-- AlterTable
ALTER TABLE "Team" ADD COLUMN "crystalApiKeyEnc" JSONB;
ALTER TABLE "Team" ADD COLUMN "crystalApiKeyConfiguredAt" TIMESTAMP(3);
