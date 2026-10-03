-- Creator funnel keyword auto-replies (phase 4b). Additive only: two enums and two new tables.
-- KeywordTrigger.landingPageId has no foreign key: Landing* tables aren't created by migrations.
-- CreateEnum
CREATE TYPE "KeywordTriggerScope" AS ENUM ('COMMENT', 'DM', 'BOTH');

-- CreateEnum
CREATE TYPE "KeywordMatch" AS ENUM ('EXACT', 'CONTAINS');

-- CreateTable
CREATE TABLE "KeywordTrigger" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "scope" "KeywordTriggerScope" NOT NULL DEFAULT 'COMMENT',
    "keywords" TEXT[],
    "match" "KeywordMatch" NOT NULL DEFAULT 'CONTAINS',
    "contentPostId" TEXT,
    "replyText" TEXT NOT NULL,
    "publicCommentReply" TEXT,
    "landingPageId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "activatedById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordTriggerReply" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "personHandle" TEXT,
    "commentId" TEXT,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "publicStatus" TEXT,
    "messageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordTriggerReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordTrigger_teamId_idx" ON "KeywordTrigger"("teamId");

-- CreateIndex
CREATE INDEX "KeywordTrigger_socialAccountId_active_idx" ON "KeywordTrigger"("socialAccountId", "active");

-- CreateIndex
CREATE INDEX "KeywordTriggerReply_triggerId_personKey_createdAt_idx" ON "KeywordTriggerReply"("triggerId", "personKey", "createdAt");

-- CreateIndex
CREATE INDEX "KeywordTriggerReply_status_createdAt_idx" ON "KeywordTriggerReply"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KeywordTriggerReply_socialAccountId_updatedAt_idx" ON "KeywordTriggerReply"("socialAccountId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordTriggerReply_socialAccountId_sourceKey_key" ON "KeywordTriggerReply"("socialAccountId", "sourceKey");

-- AddForeignKey
ALTER TABLE "KeywordTrigger" ADD CONSTRAINT "KeywordTrigger_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordTrigger" ADD CONSTRAINT "KeywordTrigger_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordTrigger" ADD CONSTRAINT "KeywordTrigger_contentPostId_fkey" FOREIGN KEY ("contentPostId") REFERENCES "ContentPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordTriggerReply" ADD CONSTRAINT "KeywordTriggerReply_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "KeywordTrigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

