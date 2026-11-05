CREATE TABLE "McpToolAction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "grantId" TEXT NOT NULL REFERENCES "McpOAuthGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "argumentsJson" TEXT NOT NULL,
  "argumentsHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "retainUntil" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "webClaimedAt" TIMESTAMP(3),
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "McpToolAction_grantId_requestId_key" ON "McpToolAction"("grantId", "requestId");
CREATE INDEX "McpToolAction_grantId_status_idx" ON "McpToolAction"("grantId", "status");
CREATE INDEX "McpToolAction_retainUntil_idx" ON "McpToolAction"("retainUntil");
CREATE INDEX "McpOAuthClient_createdAt_idx" ON "McpOAuthClient"("createdAt");
CREATE INDEX "McpOAuthCode_expiresAt_idx" ON "McpOAuthCode"("expiresAt");
