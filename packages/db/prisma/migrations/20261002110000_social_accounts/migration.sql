-- Creator funnel: connected social accounts. Additive only: a new enum and a new table.
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK_PAGE', 'INSTAGRAM', 'LINKEDIN_MEMBER', 'LINKEDIN_ORG');

CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "handle" TEXT,
    "parentExternalId" TEXT,
    "encryptedToken" JSONB,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "expiryWarnedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialAccount_teamId_platform_externalId_key" ON "SocialAccount"("teamId", "platform", "externalId");
CREATE INDEX "SocialAccount_teamId_idx" ON "SocialAccount"("teamId");
CREATE INDEX "SocialAccount_status_lastCheckedAt_idx" ON "SocialAccount"("status", "lastCheckedAt");

ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
