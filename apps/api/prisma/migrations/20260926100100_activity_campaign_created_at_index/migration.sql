-- roadmap 3.2 (I-09): Activity has no teamId column. The team feed
-- (apps/api/routes/dashboard/activities/route.ts) scopes through campaignId and
-- sorts by createdAt DESC, and campaignId (a foreign key to Campaign) had no
-- index at all. CONCURRENTLY keeps writes flowing during the build. It cannot
-- run inside a transaction block, so this file holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Activity_campaignId_createdAt_idx" ON "Activity"("campaignId", "createdAt");
