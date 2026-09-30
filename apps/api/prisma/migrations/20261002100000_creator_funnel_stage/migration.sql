-- Creator funnel foundation. Additive only: two new enum types and nullable columns, no defaults, no backfill.
CREATE TYPE "FunnelStage" AS ENUM ('TOFU', 'MOFU', 'BOFU', 'POST');
CREATE TYPE "NurtureOwner" AS ENUM ('CMF', 'MAUTIC');

ALTER TABLE "Lead" ADD COLUMN "funnelStage" "FunnelStage",
ADD COLUMN "nurtureOwner" "NurtureOwner";
ALTER TABLE "CampaignSequence" ADD COLUMN "funnelStage" "FunnelStage";
ALTER TABLE "Team" ADD COLUMN "nurtureProvider" "NurtureOwner";

-- "LandingPage" was never created by a tracked migration (production has it from an earlier
-- out-of-band `prisma db push`; see 20260916100000_campaign_landing_icp), so a from-scratch
-- `migrate deploy` (CI, a fresh env) has no such table. Guarded the same way.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LandingPage') THEN
    ALTER TABLE "LandingPage" ADD COLUMN "funnelStage" "FunnelStage";
  END IF;
END
$$;
