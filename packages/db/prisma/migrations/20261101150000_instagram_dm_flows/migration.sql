-- Instagram DM flows (creator funnel). Every statement is guarded so a re-run or a partly applied database is safe.

-- CreateTable
CREATE TABLE IF NOT EXISTS "DmFlow" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmFlow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DmFlow_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DmFlowRun" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "leadId" TEXT,
    "steps" JSONB NOT NULL,
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "awaitingAnswer" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "waitingSince" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmFlowRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DmFlowRun_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DmFlowRun_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "DmFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DmFlowEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stepIndex" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmFlowEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DmFlowEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DmFlowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "KeywordTrigger" ADD COLUMN IF NOT EXISTS "flowId" TEXT;

-- AddForeignKey (no IF NOT EXISTS for constraints in Postgres, so check the catalog first)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KeywordTrigger_flowId_fkey') THEN
        ALTER TABLE "KeywordTrigger" ADD CONSTRAINT "KeywordTrigger_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "DmFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DmFlow_teamId_idx" ON "DmFlow"("teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "DmFlowRun_flowId_personKey_key" ON "DmFlowRun"("flowId", "personKey");
CREATE INDEX IF NOT EXISTS "DmFlowRun_teamId_idx" ON "DmFlowRun"("teamId");
CREATE INDEX IF NOT EXISTS "DmFlowRun_status_waitingSince_idx" ON "DmFlowRun"("status", "waitingSince");
CREATE UNIQUE INDEX IF NOT EXISTS "DmFlowEvent_runId_sourceKey_key" ON "DmFlowEvent"("runId", "sourceKey");
CREATE INDEX IF NOT EXISTS "DmFlowEvent_kind_createdAt_idx" ON "DmFlowEvent"("kind", "createdAt");
