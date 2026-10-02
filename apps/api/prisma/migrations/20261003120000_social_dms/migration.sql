-- Creator funnel DMs (phase 4a). Additive only: a new table and one nullable unique column.
CREATE TABLE "SocialContact" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "handle" TEXT,
    "name" TEXT,
    "leadId" TEXT NOT NULL,
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialContact_socialAccountId_externalUserId_key" ON "SocialContact"("socialAccountId", "externalUserId");
CREATE INDEX "SocialContact_teamId_idx" ON "SocialContact"("teamId");
CREATE INDEX "SocialContact_leadId_idx" ON "SocialContact"("leadId");

ALTER TABLE "SocialContact" ADD CONSTRAINT "SocialContact_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialContact" ADD CONSTRAINT "SocialContact_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialContact" ADD CONSTRAINT "SocialContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Message_externalId_key" ON "Message"("externalId");
