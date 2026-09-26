-- roadmap 3.2 (I-09): lead lists filter on teamId and sort by updatedAt DESC
-- (apps/api/routes/leads/route.ts, apps/web leads page and dashboard summary).
-- CONCURRENTLY keeps writes flowing during the build. It cannot run inside a
-- transaction block, so this file holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Lead_teamId_updatedAt_idx" ON "Lead"("teamId", "updatedAt");
