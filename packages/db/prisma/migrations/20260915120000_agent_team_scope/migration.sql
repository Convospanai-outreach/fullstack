-- Scopes Agent rows per-team so different teams no longer share the same
-- role's Agent row. Nullable (not backfilled): there is no correct team
-- owner for a pre-existing shared row, and Postgres treats NULL as distinct
-- under a unique index, so legacy rows coexist safely with new team-scoped
-- ones without a migration-time collision.
ALTER TABLE "Agent" ADD COLUMN "teamId" TEXT;

CREATE UNIQUE INDEX "Agent_teamId_name_key" ON "Agent"("teamId", "name");
CREATE INDEX "Agent_teamId_idx" ON "Agent"("teamId");
