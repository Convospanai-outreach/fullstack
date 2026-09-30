-- Product-analytics milestones. Additive only: nullable, no default, no backfill.
ALTER TABLE "Team" ADD COLUMN "firstCampaignSentAt" TIMESTAMP(3);
ALTER TABLE "Team" ADD COLUMN "firstPositiveReplyAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastActiveDay" DATE;
