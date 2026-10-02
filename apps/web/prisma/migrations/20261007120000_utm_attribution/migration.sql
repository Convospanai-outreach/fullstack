-- LandingEvent isn't created by migrations in every environment (see Landing* tables), so guard it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LandingEvent') THEN
    ALTER TABLE "LandingEvent" ADD COLUMN "utmCampaign" TEXT,
    ADD COLUMN "utmContent" TEXT,
    ADD COLUMN "utmMedium" TEXT,
    ADD COLUMN "utmSource" TEXT,
    ADD COLUMN "utmTerm" TEXT;
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT;

-- AlterTable
ALTER TABLE "KeywordTriggerReply" ADD COLUMN     "mediaId" TEXT;
