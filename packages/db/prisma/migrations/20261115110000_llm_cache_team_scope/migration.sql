-- LLMCache answers were shared by every team: the lookup key and the semantic search ignored who asked.
-- Each row now carries the team whose prompt produced it. Existing rows keep a NULL team, which no
-- lookup matches, so they simply stop being served. Nothing in the app writes this table today, so a
-- plain (non-concurrent) index build is cheap.
ALTER TABLE "LLMCache" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
CREATE INDEX IF NOT EXISTS "LLMCache_teamId_idx" ON "LLMCache"("teamId");
