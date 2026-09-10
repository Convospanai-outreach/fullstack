ALTER TABLE "EdgeNode"
  ADD COLUMN "sessionTokenHash" TEXT,
  ADD COLUMN "sessionTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "EdgeNode_sessionTokenExpiresAt_idx" ON "EdgeNode"("sessionTokenExpiresAt");
