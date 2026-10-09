-- Chrome extension sync tokens (Session rows) remember the team they were generated in, so the
-- extension saves leads to that team without asking. Existing tokens keep NULL (any of the user's teams).
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
