-- Creates the six Landing* tables. No earlier migration did: production got them from an out-of-band
-- `prisma db push` (see 20260916100000_campaign_landing_icp), so a from-scratch `migrate deploy` (CI, a
-- fresh env) had none of them, and skipped the Landing* ALTERs that earlier migrations guard.
--
-- A no-op on production, where every table, index and foreign key below already exists under the same
-- name. Indexes and foreign keys are created only when the catalog lacks them: CREATE INDEX IF NOT EXISTS
-- would first take a SHARE lock on the table, blocking writes, before finding the index.
--
-- DDL from `prisma migrate diff`, with columns in production's order (columns those ALTERs added come
-- last), so a fresh database matches production column for column.

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingCampaign" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "ownerId" TEXT,
    "linkedCampaignId" TEXT,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "framework" TEXT,
    "challenge" TEXT,
    "solution" TEXT,
    "benefit" TEXT,
    "selectedWireframeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "icpId" TEXT,

    CONSTRAINT "LandingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingAsset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceName" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingWireframeOption" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "framework" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "structure" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingWireframeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingPage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "editorState" JSONB,
    "renderedJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "funnelStage" "FunnelStage",

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingLead" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sessionId" TEXT,
    "pageVersion" INTEGER,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "title" TEXT,
    "rawPayload" JSONB,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "socialToken" TEXT,
    "whatsappConsent" BOOLEAN,

    CONSTRAINT "LandingLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingEvent" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventName" TEXT NOT NULL,
    "eventData" JSONB,
    "pageVersion" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmMedium" TEXT,
    "utmSource" TEXT,
    "utmTerm" TEXT,

    CONSTRAINT "LandingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$
BEGIN
  IF to_regclass('"LandingCampaign_teamId_idx"') IS NULL THEN
    CREATE INDEX "LandingCampaign_teamId_idx" ON "LandingCampaign"("teamId");
  END IF;
  IF to_regclass('"LandingCampaign_status_idx"') IS NULL THEN
    CREATE INDEX "LandingCampaign_status_idx" ON "LandingCampaign"("status");
  END IF;
  IF to_regclass('"LandingCampaign_createdAt_idx"') IS NULL THEN
    CREATE INDEX "LandingCampaign_createdAt_idx" ON "LandingCampaign"("createdAt");
  END IF;
  IF to_regclass('"LandingCampaign_linkedCampaignId_idx"') IS NULL THEN
    CREATE INDEX "LandingCampaign_linkedCampaignId_idx" ON "LandingCampaign"("linkedCampaignId");
  END IF;
  IF to_regclass('"LandingCampaign_icpId_idx"') IS NULL THEN
    CREATE INDEX "LandingCampaign_icpId_idx" ON "LandingCampaign"("icpId");
  END IF;
  IF to_regclass('"LandingAsset_campaignId_idx"') IS NULL THEN
    CREATE INDEX "LandingAsset_campaignId_idx" ON "LandingAsset"("campaignId");
  END IF;
  IF to_regclass('"LandingAsset_createdAt_idx"') IS NULL THEN
    CREATE INDEX "LandingAsset_createdAt_idx" ON "LandingAsset"("createdAt");
  END IF;
  IF to_regclass('"LandingWireframeOption_campaignId_idx"') IS NULL THEN
    CREATE INDEX "LandingWireframeOption_campaignId_idx" ON "LandingWireframeOption"("campaignId");
  END IF;
  IF to_regclass('"LandingWireframeOption_createdAt_idx"') IS NULL THEN
    CREATE INDEX "LandingWireframeOption_createdAt_idx" ON "LandingWireframeOption"("createdAt");
  END IF;
  IF to_regclass('"LandingPage_slug_key"') IS NULL THEN
    CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");
  END IF;
  IF to_regclass('"LandingPage_campaignId_idx"') IS NULL THEN
    CREATE INDEX "LandingPage_campaignId_idx" ON "LandingPage"("campaignId");
  END IF;
  IF to_regclass('"LandingPage_teamId_idx"') IS NULL THEN
    CREATE INDEX "LandingPage_teamId_idx" ON "LandingPage"("teamId");
  END IF;
  IF to_regclass('"LandingPage_status_idx"') IS NULL THEN
    CREATE INDEX "LandingPage_status_idx" ON "LandingPage"("status");
  END IF;
  IF to_regclass('"LandingPage_createdAt_idx"') IS NULL THEN
    CREATE INDEX "LandingPage_createdAt_idx" ON "LandingPage"("createdAt");
  END IF;
  IF to_regclass('"LandingLead_landingPageId_idx"') IS NULL THEN
    CREATE INDEX "LandingLead_landingPageId_idx" ON "LandingLead"("landingPageId");
  END IF;
  IF to_regclass('"LandingLead_campaignId_idx"') IS NULL THEN
    CREATE INDEX "LandingLead_campaignId_idx" ON "LandingLead"("campaignId");
  END IF;
  IF to_regclass('"LandingLead_teamId_createdAt_idx"') IS NULL THEN
    CREATE INDEX "LandingLead_teamId_createdAt_idx" ON "LandingLead"("teamId", "createdAt");
  END IF;
  IF to_regclass('"LandingLead_email_idx"') IS NULL THEN
    CREATE INDEX "LandingLead_email_idx" ON "LandingLead"("email");
  END IF;
  IF to_regclass('"LandingEvent_landingPageId_idx"') IS NULL THEN
    CREATE INDEX "LandingEvent_landingPageId_idx" ON "LandingEvent"("landingPageId");
  END IF;
  IF to_regclass('"LandingEvent_campaignId_idx"') IS NULL THEN
    CREATE INDEX "LandingEvent_campaignId_idx" ON "LandingEvent"("campaignId");
  END IF;
  IF to_regclass('"LandingEvent_teamId_createdAt_idx"') IS NULL THEN
    CREATE INDEX "LandingEvent_teamId_createdAt_idx" ON "LandingEvent"("teamId", "createdAt");
  END IF;
  IF to_regclass('"LandingEvent_eventName_idx"') IS NULL THEN
    CREATE INDEX "LandingEvent_eventName_idx" ON "LandingEvent"("eventName");
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingCampaign"'::regclass AND conname = 'LandingCampaign_teamId_fkey') THEN
    ALTER TABLE "LandingCampaign" ADD CONSTRAINT "LandingCampaign_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingCampaign"'::regclass AND conname = 'LandingCampaign_ownerId_fkey') THEN
    ALTER TABLE "LandingCampaign" ADD CONSTRAINT "LandingCampaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingCampaign"'::regclass AND conname = 'LandingCampaign_linkedCampaignId_fkey') THEN
    ALTER TABLE "LandingCampaign" ADD CONSTRAINT "LandingCampaign_linkedCampaignId_fkey" FOREIGN KEY ("linkedCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingCampaign"'::regclass AND conname = 'LandingCampaign_icpId_fkey') THEN
    ALTER TABLE "LandingCampaign" ADD CONSTRAINT "LandingCampaign_icpId_fkey" FOREIGN KEY ("icpId") REFERENCES "ICP"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingAsset"'::regclass AND conname = 'LandingAsset_campaignId_fkey') THEN
    ALTER TABLE "LandingAsset" ADD CONSTRAINT "LandingAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LandingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingWireframeOption"'::regclass AND conname = 'LandingWireframeOption_campaignId_fkey') THEN
    ALTER TABLE "LandingWireframeOption" ADD CONSTRAINT "LandingWireframeOption_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LandingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingPage"'::regclass AND conname = 'LandingPage_campaignId_fkey') THEN
    ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LandingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingPage"'::regclass AND conname = 'LandingPage_teamId_fkey') THEN
    ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingLead"'::regclass AND conname = 'LandingLead_landingPageId_fkey') THEN
    ALTER TABLE "LandingLead" ADD CONSTRAINT "LandingLead_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingLead"'::regclass AND conname = 'LandingLead_campaignId_fkey') THEN
    ALTER TABLE "LandingLead" ADD CONSTRAINT "LandingLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LandingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingLead"'::regclass AND conname = 'LandingLead_teamId_fkey') THEN
    ALTER TABLE "LandingLead" ADD CONSTRAINT "LandingLead_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingEvent"'::regclass AND conname = 'LandingEvent_landingPageId_fkey') THEN
    ALTER TABLE "LandingEvent" ADD CONSTRAINT "LandingEvent_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingEvent"'::regclass AND conname = 'LandingEvent_campaignId_fkey') THEN
    ALTER TABLE "LandingEvent" ADD CONSTRAINT "LandingEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LandingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"LandingEvent"'::regclass AND conname = 'LandingEvent_teamId_fkey') THEN
    ALTER TABLE "LandingEvent" ADD CONSTRAINT "LandingEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
