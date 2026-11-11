-- Lead custom properties (phase 10). Every statement is guarded so a re-run or a partly applied database is safe.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "customFields" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeadProperty" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadProperty_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LeadProperty_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeadProperty_teamId_key_key" ON "LeadProperty"("teamId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeadProperty_teamId_idx" ON "LeadProperty"("teamId");
