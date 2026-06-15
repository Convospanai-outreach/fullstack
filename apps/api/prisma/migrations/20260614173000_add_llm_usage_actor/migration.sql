ALTER TABLE "LLMUsageLog" ADD COLUMN "actorId" TEXT;

CREATE INDEX "LLMUsageLog_actorId_createdAt_idx" ON "LLMUsageLog"("actorId", "createdAt");

ALTER TABLE "LLMUsageLog"
ADD CONSTRAINT "LLMUsageLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
