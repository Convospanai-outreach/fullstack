-- Google Workspace connected inboxes and outreach tracking.

ALTER TABLE "Email"
ADD COLUMN "mailboxId" TEXT,
ADD COLUMN "threadId" TEXT,
ADD COLUMN "trackingId" TEXT,
ADD COLUMN "repliedAt" TIMESTAMP(3),
ADD COLUMN "bouncedAt" TIMESTAMP(3),
ADD COLUMN "unsubscribedAt" TIMESTAMP(3);

CREATE TABLE "ConnectedMailbox" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'GOOGLE_WORKSPACE',
    "authType" TEXT NOT NULL DEFAULT 'OAUTH',
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "encryptedAccessToken" JSONB,
    "encryptedRefreshToken" JSONB,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "historyId" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 50,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "sentTodayDate" TIMESTAMP(3),
    "minDelaySeconds" INTEGER NOT NULL DEFAULT 180,
    "lastSentAt" TIMESTAMP(3),
    "isWarmingUp" BOOLEAN NOT NULL DEFAULT true,
    "warmupDay" INTEGER NOT NULL DEFAULT 0,
    "warmupTargetDays" INTEGER NOT NULL DEFAULT 30,
    "warmupLastAdvancedAt" TIMESTAMP(3),
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedMailbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "emailId" TEXT,
    "mailboxId" TEXT,
    "leadId" TEXT,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'UNSUBSCRIBE',
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "leadId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Email_trackingId_key" ON "Email"("trackingId");
CREATE INDEX "Email_mailboxId_idx" ON "Email"("mailboxId");
CREATE INDEX "Email_repliedAt_idx" ON "Email"("repliedAt");
CREATE INDEX "Email_bouncedAt_idx" ON "Email"("bouncedAt");

CREATE UNIQUE INDEX "ConnectedMailbox_teamId_email_key" ON "ConnectedMailbox"("teamId", "email");
CREATE UNIQUE INDEX "ConnectedMailbox_teamId_lower_email_key" ON "ConnectedMailbox"("teamId", lower("email"));
CREATE INDEX "ConnectedMailbox_teamId_idx" ON "ConnectedMailbox"("teamId");
CREATE INDEX "ConnectedMailbox_assignedUserId_idx" ON "ConnectedMailbox"("assignedUserId");
CREATE INDEX "ConnectedMailbox_status_idx" ON "ConnectedMailbox"("status");

CREATE INDEX "EmailEvent_teamId_idx" ON "EmailEvent"("teamId");
CREATE INDEX "EmailEvent_emailId_idx" ON "EmailEvent"("emailId");
CREATE INDEX "EmailEvent_mailboxId_idx" ON "EmailEvent"("mailboxId");
CREATE INDEX "EmailEvent_leadId_idx" ON "EmailEvent"("leadId");
CREATE INDEX "EmailEvent_campaignId_idx" ON "EmailEvent"("campaignId");
CREATE INDEX "EmailEvent_type_idx" ON "EmailEvent"("type");
CREATE INDEX "EmailEvent_createdAt_idx" ON "EmailEvent"("createdAt");
CREATE UNIQUE INDEX "EmailEvent_teamId_provider_providerMessageId_type_key" ON "EmailEvent"("teamId", "provider", "providerMessageId", "type");

CREATE UNIQUE INDEX "SuppressionEntry_teamId_email_key" ON "SuppressionEntry"("teamId", "email");
CREATE INDEX "SuppressionEntry_teamId_idx" ON "SuppressionEntry"("teamId");
CREATE INDEX "SuppressionEntry_reason_idx" ON "SuppressionEntry"("reason");

ALTER TABLE "Email" ADD CONSTRAINT "Email_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ConnectedMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConnectedMailbox" ADD CONSTRAINT "ConnectedMailbox_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectedMailbox" ADD CONSTRAINT "ConnectedMailbox_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ConnectedMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SuppressionEntry" ADD CONSTRAINT "SuppressionEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuppressionEntry" ADD CONSTRAINT "SuppressionEntry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SuppressionEntry" ADD CONSTRAINT "SuppressionEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
