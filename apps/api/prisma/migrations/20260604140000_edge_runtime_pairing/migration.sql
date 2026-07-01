ALTER TABLE "EdgeNode" ALTER COLUMN "ipAddress" DROP NOT NULL;

ALTER TABLE "EdgeNode"
  ADD COLUMN "hardwareFingerprintHash" TEXT,
  ADD COLUMN "publicKey" TEXT,
  ADD COLUMN "attestationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "runtimeVersion" TEXT,
  ADD COLUMN "buildHash" TEXT,
  ADD COLUMN "capabilities" JSONB,
  ADD COLUMN "piiStorageMode" TEXT NOT NULL DEFAULT 'edge_only',
  ADD COLUMN "vaultState" TEXT NOT NULL DEFAULT 'LOCKED',
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "pairedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "removalReason" TEXT;

UPDATE "EdgeNode"
SET "lastSeenAt" = COALESCE("lastSeenAt", "lastSync")
WHERE "lastSeenAt" IS NULL;

CREATE UNIQUE INDEX "EdgeNode_hardwareFingerprintHash_key" ON "EdgeNode"("hardwareFingerprintHash");
CREATE INDEX "EdgeNode_teamId_status_idx" ON "EdgeNode"("teamId", "status");
CREATE INDEX "EdgeNode_lastSeenAt_idx" ON "EdgeNode"("lastSeenAt");

-- CreateOrphanAuditTable
CREATE TABLE IF NOT EXISTS "EdgeNodeOrphanAudit" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "hardwareId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "status" TEXT NOT NULL,
  "lastSync" TIMESTAMP(3) NOT NULL,
  "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "auditReason" TEXT NOT NULL DEFAULT 'pre_fk_orphan_quarantine'
);

-- BackUpOrphans
INSERT INTO "EdgeNodeOrphanAudit" (
  "id", "teamId", "hardwareId", "ipAddress", "status", "lastSync"
)
SELECT 
  "id", "teamId", "hardwareId", "ipAddress", "status", "lastSync"
FROM "EdgeNode"
WHERE NOT EXISTS (
  SELECT 1 FROM "Team" WHERE "Team"."id" = "EdgeNode"."teamId"
);

-- DeleteOrphans
DELETE FROM "EdgeNode"
WHERE NOT EXISTS (
  SELECT 1 FROM "Team" WHERE "Team"."id" = "EdgeNode"."teamId"
);

-- AddForeignKey
ALTER TABLE "EdgeNode"
  ADD CONSTRAINT "EdgeNode_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
