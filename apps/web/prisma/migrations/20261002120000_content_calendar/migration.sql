-- Creator funnel content calendar. Additive only: a new enum, two new tables, one nullable column.
CREATE TYPE "ContentPostStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

ALTER TABLE "Team" ADD COLUMN "contentStageMix" JSONB;

CREATE TABLE "ContentPost" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "funnelStage" "FunnelStage" NOT NULL,
    "status" "ContentPostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "timezone" TEXT,
    "approvalRequestId" TEXT,
    "reviewNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPostTarget" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPostTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentPost_teamId_scheduledAt_idx" ON "ContentPost"("teamId", "scheduledAt");
CREATE INDEX "ContentPost_status_scheduledAt_idx" ON "ContentPost"("status", "scheduledAt");
CREATE UNIQUE INDEX "ContentPostTarget_postId_socialAccountId_key" ON "ContentPostTarget"("postId", "socialAccountId");
CREATE INDEX "ContentPostTarget_socialAccountId_idx" ON "ContentPostTarget"("socialAccountId");

ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPostTarget" ADD CONSTRAINT "ContentPostTarget_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPostTarget" ADD CONSTRAINT "ContentPostTarget_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
