-- Links a saved ICP to the campaigns and landing campaigns generated for it, so
-- AI drafting (email-worker, batch drafts, landing-page briefs) has real audience
-- context instead of the previously hardcoded null. Nullable + ON DELETE SET NULL:
-- existing rows have no ICP, and deleting an ICP shouldn't cascade-delete the work
-- built from it.
ALTER TABLE "Campaign" ADD COLUMN "icpId" TEXT;
CREATE INDEX "Campaign_icpId_idx" ON "Campaign"("icpId");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_icpId_fkey"
  FOREIGN KEY ("icpId") REFERENCES "ICP"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- "LandingCampaign" was never created by a tracked migration (it exists in
-- production via an earlier out-of-band `prisma db push`, not migration
-- history), so a from-scratch `prisma migrate deploy` (CI, a fresh env) has
-- no such table. Guarded so this migration succeeds either way instead of
-- crashing CI on a pre-existing gap unrelated to this change.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LandingCampaign') THEN
    ALTER TABLE "LandingCampaign" ADD COLUMN "icpId" TEXT;
    CREATE INDEX "LandingCampaign_icpId_idx" ON "LandingCampaign"("icpId");
    ALTER TABLE "LandingCampaign" ADD CONSTRAINT "LandingCampaign_icpId_fkey"
      FOREIGN KEY ("icpId") REFERENCES "ICP"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
