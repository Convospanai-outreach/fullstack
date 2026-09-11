-- Production-grade Google Workspace outreach foundation.
-- Additive only: existing mailbox, event, suppression, and email data is preserved.

CREATE TABLE "TrackedLink" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "emailId" TEXT,
    "mailboxId" TEXT,
    "campaignId" TEXT,
    "leadId" TEXT,
    "trackingKey" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "firstClickedAt" TIMESTAMP(3),
    "lastClickedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MailboxHealthSnapshot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "bounceRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "replyRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "openRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "clickRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "sentLast24h" INTEGER NOT NULL DEFAULT 0,
    "bouncedLast24h" INTEGER NOT NULL DEFAULT 0,
    "complainedLast24h" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailboxHealthSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MailboxSyncCursor" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "cursorType" TEXT NOT NULL DEFAULT 'GMAIL_HISTORY',
    "historyId" TEXT,
    "pageToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxSyncCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignSequence" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepType" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "campaignId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentStepOrder" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceStepRun" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "sequenceStepId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "emailId" TEXT,
    "leadId" TEXT,
    "campaignId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStepRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DomainAuthenticationCheck" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "spfStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dkimStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dmarcStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "mxStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainAuthenticationCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackedLink_teamId_trackingKey_key" ON "TrackedLink"("teamId", "trackingKey");
CREATE INDEX "TrackedLink_teamId_idx" ON "TrackedLink"("teamId");
CREATE INDEX "TrackedLink_emailId_idx" ON "TrackedLink"("emailId");
CREATE INDEX "TrackedLink_mailboxId_idx" ON "TrackedLink"("mailboxId");
CREATE INDEX "TrackedLink_campaignId_idx" ON "TrackedLink"("campaignId");
CREATE INDEX "TrackedLink_leadId_idx" ON "TrackedLink"("leadId");
CREATE INDEX "TrackedLink_status_idx" ON "TrackedLink"("status");
CREATE INDEX "TrackedLink_createdAt_idx" ON "TrackedLink"("createdAt");

CREATE INDEX "MailboxHealthSnapshot_team_checked_idx" ON "MailboxHealthSnapshot"("teamId", "checkedAt");
CREATE INDEX "MailboxHealthSnapshot_mailbox_checked_idx" ON "MailboxHealthSnapshot"("mailboxId", "checkedAt");
CREATE INDEX "MailboxHealthSnapshot_status_idx" ON "MailboxHealthSnapshot"("status");

CREATE UNIQUE INDEX "MailboxSyncCursor_mailbox_type_key" ON "MailboxSyncCursor"("mailboxId", "cursorType");
CREATE INDEX "MailboxSyncCursor_teamId_idx" ON "MailboxSyncCursor"("teamId");
CREATE INDEX "MailboxSyncCursor_status_idx" ON "MailboxSyncCursor"("status");
CREATE INDEX "MailboxSyncCursor_lastSyncedAt_idx" ON "MailboxSyncCursor"("lastSyncedAt");

CREATE INDEX "CampaignSequence_teamId_idx" ON "CampaignSequence"("teamId");
CREATE INDEX "CampaignSequence_campaignId_idx" ON "CampaignSequence"("campaignId");
CREATE INDEX "CampaignSequence_status_idx" ON "CampaignSequence"("status");
CREATE INDEX "CampaignSequence_createdAt_idx" ON "CampaignSequence"("createdAt");

CREATE UNIQUE INDEX "SequenceStep_sequence_order_key" ON "SequenceStep"("sequenceId", "stepOrder");
CREATE INDEX "SequenceStep_teamId_idx" ON "SequenceStep"("teamId");
CREATE INDEX "SequenceStep_sequenceId_idx" ON "SequenceStep"("sequenceId");
CREATE INDEX "SequenceStep_status_idx" ON "SequenceStep"("status");

CREATE UNIQUE INDEX "SequenceEnrollment_sequence_lead_key" ON "SequenceEnrollment"("sequenceId", "leadId");
CREATE INDEX "SequenceEnrollment_teamId_idx" ON "SequenceEnrollment"("teamId");
CREATE INDEX "SequenceEnrollment_leadId_idx" ON "SequenceEnrollment"("leadId");
CREATE INDEX "SequenceEnrollment_mailboxId_idx" ON "SequenceEnrollment"("mailboxId");
CREATE INDEX "SequenceEnrollment_campaignId_idx" ON "SequenceEnrollment"("campaignId");
CREATE INDEX "SequenceEnrollment_status_idx" ON "SequenceEnrollment"("status");
CREATE INDEX "SequenceEnrollment_nextRunAt_idx" ON "SequenceEnrollment"("nextRunAt");

CREATE INDEX "SequenceStepRun_teamId_idx" ON "SequenceStepRun"("teamId");
CREATE INDEX "SequenceStepRun_enrollmentId_idx" ON "SequenceStepRun"("enrollmentId");
CREATE INDEX "SequenceStepRun_sequenceStepId_idx" ON "SequenceStepRun"("sequenceStepId");
CREATE INDEX "SequenceStepRun_mailboxId_idx" ON "SequenceStepRun"("mailboxId");
CREATE INDEX "SequenceStepRun_emailId_idx" ON "SequenceStepRun"("emailId");
CREATE INDEX "SequenceStepRun_leadId_idx" ON "SequenceStepRun"("leadId");
CREATE INDEX "SequenceStepRun_campaignId_idx" ON "SequenceStepRun"("campaignId");
CREATE INDEX "SequenceStepRun_status_idx" ON "SequenceStepRun"("status");
CREATE INDEX "SequenceStepRun_scheduledAt_idx" ON "SequenceStepRun"("scheduledAt");
CREATE INDEX "SequenceStepRun_providerMessageId_idx" ON "SequenceStepRun"("providerMessageId");

CREATE UNIQUE INDEX "DomainAuthenticationCheck_team_domain_key" ON "DomainAuthenticationCheck"("teamId", "domain");
CREATE INDEX "DomainAuthenticationCheck_teamId_idx" ON "DomainAuthenticationCheck"("teamId");
CREATE INDEX "DomainAuthenticationCheck_mailboxId_idx" ON "DomainAuthenticationCheck"("mailboxId");
CREATE INDEX "DomainAuthenticationCheck_status_idx" ON "DomainAuthenticationCheck"("status");
CREATE INDEX "DomainAuthenticationCheck_nextCheckAt_idx" ON "DomainAuthenticationCheck"("nextCheckAt");

ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ConnectedMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MailboxHealthSnapshot" ADD CONSTRAINT "MailboxHealthSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxHealthSnapshot" ADD CONSTRAINT "MailboxHealthSnapshot_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ConnectedMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MailboxSyncCursor" ADD CONSTRAINT "MailboxSyncCursor_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxSyncCursor" ADD CONSTRAINT "MailboxSyncCursor_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ConnectedMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignSequence" ADD CONSTRAINT "CampaignSequence_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignSequence" ADD CONSTRAINT "CampaignSequence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "CampaignSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "CampaignSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ConnectedMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SequenceStepRun" ADD CONSTRAINT "SequenceStepRun_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceStepRun" ADD CONSTRAINT "SequenceStepRun_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SequenceEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceStepRun" ADD CONSTRAINT "SequenceStepRun_sequenceStepId_fkey" FOREIGN KEY ("sequenceStepId") REFERENCES "SequenceStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceStepRun" ADD CONSTRAINT "SequenceStepRun_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ConnectedMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SequenceStepRun" ADD CONSTRAINT "SequenceStepRun_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SequenceStepRun" ADD CONSTRAINT "SequenceStepRun_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SequenceStepRun" ADD CONSTRAINT "SequenceStepRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DomainAuthenticationCheck" ADD CONSTRAINT "DomainAuthenticationCheck_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DomainAuthenticationCheck" ADD CONSTRAINT "DomainAuthenticationCheck_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ConnectedMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
