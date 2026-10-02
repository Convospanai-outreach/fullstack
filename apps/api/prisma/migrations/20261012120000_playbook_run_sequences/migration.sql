-- Creator funnel phase 5c-1a: the launch plan's email sequence campaigns. Additive only: three
-- nullable TEXT columns holding plain ids (no FK, like the 5b bundle ids).
ALTER TABLE "PlaybookRun" ADD COLUMN "cartAbandonCampaignId" TEXT,
ADD COLUMN     "nurtureCampaignId" TEXT,
ADD COLUMN     "postPurchaseCampaignId" TEXT;
