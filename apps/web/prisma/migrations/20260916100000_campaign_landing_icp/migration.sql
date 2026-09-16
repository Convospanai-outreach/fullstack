-- Links a saved ICP to the campaigns and landing campaigns generated for it, so
-- AI drafting (email-worker, batch drafts, landing-page briefs) has real audience
-- context instead of the previously hardcoded null. Nullable + ON DELETE SET NULL:
-- existing rows have no ICP, and deleting an ICP shouldn't cascade-delete the work
-- built from it.
ALTER TABLE "Campaign" ADD COLUMN "icpId" TEXT;
CREATE INDEX "Campaign_icpId_idx" ON "Campaign"("icpId");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_icpId_fkey"
  FOREIGN KEY ("icpId") REFERENCES "ICP"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LandingCampaign" ADD COLUMN "icpId" TEXT;
CREATE INDEX "LandingCampaign_icpId_idx" ON "LandingCampaign"("icpId");
ALTER TABLE "LandingCampaign" ADD CONSTRAINT "LandingCampaign_icpId_fkey"
  FOREIGN KEY ("icpId") REFERENCES "ICP"("id") ON DELETE SET NULL ON UPDATE CASCADE;
