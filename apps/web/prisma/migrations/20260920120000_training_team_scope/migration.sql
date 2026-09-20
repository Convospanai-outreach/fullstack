-- Tenant-scopes training data (roadmap.md item 2.7 / S-04). Nullable, not
-- backfilled: pre-existing rows predate tenant scoping and have no correct
-- team owner. Matches the Agent.teamId precedent
-- (20260915120000_agent_team_scope).
ALTER TABLE "TrainingDataset" ADD COLUMN "teamId" TEXT;
ALTER TABLE "TrainingRecord" ADD COLUMN "teamId" TEXT;

CREATE INDEX "TrainingDataset_teamId_idx" ON "TrainingDataset"("teamId");
CREATE INDEX "TrainingRecord_teamId_idx" ON "TrainingRecord"("teamId");
