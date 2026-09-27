-- roadmap 3.2 (I-09): the approvals list (ApprovalService.getPendingRequests)
-- and the pending-approval counts filter on teamId AND status.
-- CONCURRENTLY keeps writes flowing during the build. It cannot run inside a
-- transaction block, so this file holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ApprovalRequest_teamId_status_idx" ON "ApprovalRequest"("teamId", "status");
