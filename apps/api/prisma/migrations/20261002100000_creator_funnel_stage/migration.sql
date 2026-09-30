-- Creator funnel foundation. Additive only: two new enum types and nullable columns, no defaults, no backfill.
CREATE TYPE "FunnelStage" AS ENUM ('TOFU', 'MOFU', 'BOFU', 'POST');
CREATE TYPE "NurtureOwner" AS ENUM ('CMF', 'MAUTIC');

ALTER TABLE "Lead" ADD COLUMN "funnelStage" "FunnelStage",
ADD COLUMN "nurtureOwner" "NurtureOwner";
ALTER TABLE "CampaignSequence" ADD COLUMN "funnelStage" "FunnelStage";
ALTER TABLE "LandingPage" ADD COLUMN "funnelStage" "FunnelStage";
ALTER TABLE "Team" ADD COLUMN "nurtureProvider" "NurtureOwner";
