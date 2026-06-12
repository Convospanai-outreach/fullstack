ALTER TABLE "Lead" ADD COLUMN "source" TEXT;
ALTER TABLE "Lead" ADD COLUMN "priority" TEXT;

CREATE TABLE "LeadChannelStatus" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadChannelStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadChannelStatus_leadId_channel_key" ON "LeadChannelStatus"("leadId", "channel");
CREATE INDEX "LeadChannelStatus_channel_status_idx" ON "LeadChannelStatus"("channel", "status");
CREATE INDEX "LeadChannelStatus_lastActivityAt_idx" ON "LeadChannelStatus"("lastActivityAt");
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");
CREATE INDEX "LeadActivity_channel_type_idx" ON "LeadActivity"("channel", "type");
CREATE INDEX "LeadActivity_createdBy_idx" ON "LeadActivity"("createdBy");

ALTER TABLE "LeadChannelStatus" ADD CONSTRAINT "LeadChannelStatus_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
