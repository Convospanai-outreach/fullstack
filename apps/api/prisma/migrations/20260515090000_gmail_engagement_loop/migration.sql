ALTER TABLE "Email"
  ADD COLUMN IF NOT EXISTS "gmailThreadId" TEXT,
  ADD COLUMN IF NOT EXISTS "trackingToken" TEXT,
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Email_trackingToken_key" ON "Email"("trackingToken");
CREATE INDEX IF NOT EXISTS "Email_providerId_idx" ON "Email"("providerId");
CREATE INDEX IF NOT EXISTS "Email_gmailThreadId_idx" ON "Email"("gmailThreadId");

CREATE TABLE IF NOT EXISTS "ConnectedMailbox" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'GOOGLE',
  "emailAddress" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "expiresAt" TIMESTAMP(3),
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "gmailHistoryId" TEXT,
  "watchExpiration" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectedMailbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConnectedMailbox_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConnectedMailbox_teamId_emailAddress_key" ON "ConnectedMailbox"("teamId", "emailAddress");
CREATE INDEX IF NOT EXISTS "ConnectedMailbox_teamId_idx" ON "ConnectedMailbox"("teamId");
CREATE INDEX IF NOT EXISTS "ConnectedMailbox_provider_status_idx" ON "ConnectedMailbox"("provider", "status");
CREATE INDEX IF NOT EXISTS "ConnectedMailbox_watchExpiration_idx" ON "ConnectedMailbox"("watchExpiration");

CREATE TABLE IF NOT EXISTS "EmailActivityLog" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "emailId" TEXT,
  "campaignId" TEXT,
  "leadId" TEXT,
  "messageId" TEXT,
  "eventType" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailActivityLog_teamId_createdAt_idx" ON "EmailActivityLog"("teamId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailActivityLog_emailId_idx" ON "EmailActivityLog"("emailId");
CREATE INDEX IF NOT EXISTS "EmailActivityLog_campaignId_idx" ON "EmailActivityLog"("campaignId");
CREATE INDEX IF NOT EXISTS "EmailActivityLog_leadId_idx" ON "EmailActivityLog"("leadId");
CREATE INDEX IF NOT EXISTS "EmailActivityLog_messageId_idx" ON "EmailActivityLog"("messageId");
CREATE INDEX IF NOT EXISTS "EmailActivityLog_eventType_idx" ON "EmailActivityLog"("eventType");

CREATE TABLE IF NOT EXISTS "EmailTrackedLink" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "emailId" TEXT,
  "campaignId" TEXT,
  "leadId" TEXT,
  "token" TEXT NOT NULL,
  "originalUrl" TEXT NOT NULL,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "lastClickedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTrackedLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailTrackedLink_token_key" ON "EmailTrackedLink"("token");
CREATE INDEX IF NOT EXISTS "EmailTrackedLink_teamId_idx" ON "EmailTrackedLink"("teamId");
CREATE INDEX IF NOT EXISTS "EmailTrackedLink_emailId_idx" ON "EmailTrackedLink"("emailId");
CREATE INDEX IF NOT EXISTS "EmailTrackedLink_campaignId_idx" ON "EmailTrackedLink"("campaignId");
CREATE INDEX IF NOT EXISTS "EmailTrackedLink_leadId_idx" ON "EmailTrackedLink"("leadId");

CREATE TABLE IF NOT EXISTS "SuppressionEntry" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SuppressionEntry_teamId_email_key" ON "SuppressionEntry"("teamId", "email");
CREATE INDEX IF NOT EXISTS "SuppressionEntry_teamId_idx" ON "SuppressionEntry"("teamId");
CREATE INDEX IF NOT EXISTS "SuppressionEntry_email_idx" ON "SuppressionEntry"("email");
CREATE INDEX IF NOT EXISTS "SuppressionEntry_reason_idx" ON "SuppressionEntry"("reason");

CREATE TABLE IF NOT EXISTS "WaitlistRequest" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "phone" TEXT,
  "useCase" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaitlistRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistRequest_email_key" ON "WaitlistRequest"("email");
CREATE INDEX IF NOT EXISTS "WaitlistRequest_status_idx" ON "WaitlistRequest"("status");
CREATE INDEX IF NOT EXISTS "WaitlistRequest_createdAt_idx" ON "WaitlistRequest"("createdAt");
