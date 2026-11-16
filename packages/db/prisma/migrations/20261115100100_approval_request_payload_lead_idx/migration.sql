-- Campaign governance and approvals look up a campaign's approval requests in the database
-- (payload.leadId).
-- CONCURRENTLY keeps writes flowing during the build. It cannot run inside a
-- transaction block, so this file holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ApprovalRequest_payload_leadId_idx" ON "ApprovalRequest"(("payload"->>'leadId'));
