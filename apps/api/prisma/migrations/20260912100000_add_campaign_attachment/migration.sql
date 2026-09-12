-- Adds file attachment support (PDF/PPT/etc.) for campaign emails.
-- Kept as its own table so the base64 blob is only loaded when explicitly
-- queried at send time, not on every campaign list/detail read.
CREATE TABLE "CampaignAttachment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignAttachment_campaignId_idx" ON "CampaignAttachment"("campaignId");

ALTER TABLE "CampaignAttachment" ADD CONSTRAINT "CampaignAttachment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
