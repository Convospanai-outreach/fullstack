-- Campaign governance and approvals look up a campaign's approval requests in the database
-- (entityId up to the first colon: a lead id, or the campaign id itself).
-- CONCURRENTLY keeps writes flowing during the build. It cannot run inside a
-- transaction block, so this file holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ApprovalRequest_entityId_prefix_idx" ON "ApprovalRequest"(split_part("entityId", ':', 1));
