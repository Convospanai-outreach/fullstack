-- roadmap 3.2 (I-09): JobQueue.dequeue filters status IN ('queued', 'pending')
-- AND processAt <= now, then orders by priority. Equality column first, range
-- column second, so future-scheduled and finished jobs are skipped in the index.
-- CONCURRENTLY keeps writes flowing during the build. It cannot run inside a
-- transaction block, so this file holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Job_status_processAt_priority_idx" ON "Job"("status", "processAt", "priority");
