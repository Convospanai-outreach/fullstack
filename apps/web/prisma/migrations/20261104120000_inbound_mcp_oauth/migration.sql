CREATE TABLE "McpOAuthClient" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "redirectUris" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "McpOAuthGrant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "sessionVersion" INTEGER NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "resource" TEXT NOT NULL,
  "accessTokenHash" TEXT,
  "refreshTokenHash" TEXT,
  "accessExpiresAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "McpOAuthGrant_accessTokenHash_key" ON "McpOAuthGrant"("accessTokenHash");
CREATE UNIQUE INDEX "McpOAuthGrant_refreshTokenHash_key" ON "McpOAuthGrant"("refreshTokenHash");
CREATE INDEX "McpOAuthGrant_userId_teamId_idx" ON "McpOAuthGrant"("userId", "teamId");
CREATE INDEX "McpOAuthGrant_expiresAt_idx" ON "McpOAuthGrant"("expiresAt");
CREATE TABLE "McpOAuthCode" (
  "hash" TEXT NOT NULL PRIMARY KEY,
  "grantId" TEXT NOT NULL REFERENCES "McpOAuthGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "redirectUri" TEXT NOT NULL,
  "codeChallenge" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "McpRelayClaim" (
  "nonce" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "McpRelayClaim_expiresAt_idx" ON "McpRelayClaim"("expiresAt");
CREATE TABLE "McpOAuthRefreshUse" (
  "hash" TEXT NOT NULL PRIMARY KEY,
  "grantId" TEXT NOT NULL REFERENCES "McpOAuthGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "McpOAuthRefreshUse_expiresAt_idx" ON "McpOAuthRefreshUse"("expiresAt");
