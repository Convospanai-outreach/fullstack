-- Landing page A/B tests (phase 6B). IF EXISTS guards on Landing* ALTERs: some Landing tables predate migrations.

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingExperiment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerPageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingExperimentVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "LandingExperimentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LandingExperiment_slug_key" ON "LandingExperiment"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LandingExperiment_teamId_idx" ON "LandingExperiment"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LandingExperimentVariant_experimentId_name_key" ON "LandingExperimentVariant"("experimentId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LandingExperimentVariant_landingPageId_idx" ON "LandingExperimentVariant"("landingPageId");

-- AddForeignKey
ALTER TABLE "LandingExperiment" ADD CONSTRAINT "LandingExperiment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingExperimentVariant" ADD CONSTRAINT "LandingExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "LandingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingExperimentVariant" ADD CONSTRAINT "LandingExperimentVariant_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE IF EXISTS "LandingLead" ADD COLUMN IF NOT EXISTS "variantId" TEXT;

-- AlterTable
ALTER TABLE IF EXISTS "LandingEvent" ADD COLUMN IF NOT EXISTS "variantId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LandingEvent_variantId_idx" ON "LandingEvent"("variantId");
