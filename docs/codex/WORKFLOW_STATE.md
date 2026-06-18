# Codex Workflow State

This file is the source of truth for current task status. Update it after every agent stage.

## Current status

| Field | Value |
| --- | --- |
| Overall status | NOT_STARTED |
| Current stage | Stage 0 - Branch and baseline |
| Current agent | orchestrator |
| Working branch | codex/vercel-supabase-db-linkage-fix |
| Last updated | TBD by Codex |
| Next action | Read IMPLEMENTATION_PLAN.md and AGENTS.md, then start Stage 0 |

## Status values

Use only these values:

- NOT_STARTED
- IN_PROGRESS
- READY_FOR_NEXT_STAGE
- NEEDS_REPLAN
- BLOCKED
- BLOCKED_EXTERNAL_ACCESS
- BLOCKED_BY_SCHEMA_CONFLICT
- BLOCKED_BY_FAILED_TESTS
- CONTROLLED_BETA_READY
- PRODUCTION_READY

## Active blockers

| Blocker | Owner agent | Evidence | Next action | Status |
| --- | --- | --- | --- | --- |
| None recorded yet | orchestrator | n/a | Start Stage 0 | NOT_STARTED |

## Stage tracker

| Stage | Agent | Status | Evidence file | Notes |
| --- | --- | --- | --- | --- |
| 0. Branch and baseline | orchestrator | NOT_STARTED | db-linkage-fix-log.md | Create safe branch and baseline |
| 1. Repo cartography | repo-cartographer | NOT_STARTED | vercel-supabase-reassessment.md | Map all linkage files |
| 2. Vercel linkage inspection | vercel-linkage-agent | NOT_STARTED | VERIFICATION_MATRIX.md | Safe environment fingerprints only |
| 3. Supabase live schema inspection | supabase-inspector | NOT_STARTED | prisma-schema-drift-matrix.md | Read-only SQL only |
| 4. Prisma ownership and drift | prisma-drift-agent | NOT_STARTED | prisma-schema-drift-matrix.md | Four-way matrix required |
| 5. Gmail/mailbox conflict resolution | prisma-drift-agent | NOT_STARTED | prisma-schema-drift-matrix.md | Do not merge PR #6 as-is |
| 6. Migration safety | migration-safety-agent | NOT_STARTED | database-production-runbook.md | DIRECT_URL required |
| 7. Runtime DB alignment | runtime-db-agent | NOT_STARTED | db-linkage-fix-log.md | Engine/client/adapter consistency |
| 8. Env linkage guards | env-guard-agent | NOT_STARTED | vercel-supabase-smoke-runbook.md | Redacted diagnostics only |
| 9. Health and smoke tests | health-smoke-agent | NOT_STARTED | vercel-supabase-smoke-runbook.md | live/ready/deep probes |
| 10. Clerk/app DB linkage | auth-tenant-agent | NOT_STARTED | production-readiness-final.md | Clerk to User to TeamMember |
| 11. Redis/cache/queue isolation | redis-cache-agent | NOT_STARTED | production-readiness-final.md | Namespace and environment isolation |
| 12. CI and PR strategy | ci-gate-agent | NOT_STARTED | production-readiness-final.md | Drift gates and PR #6 split |
| 13. Final readiness | release-readiness-agent | NOT_STARTED | production-readiness-final.md | Final evidence and status |

## Latest findings

No findings recorded yet.

## Decisions

| Decision | Date | Agent | Evidence | Status |
| --- | --- | --- | --- | --- |
| No decisions yet | TBD | orchestrator | n/a | PENDING |

## Next action queue

1. Confirm working branch and baseline commit.
2. Read the orchestration files.
3. Start Stage 0.
4. Update this file after Stage 0.
5. Continue to Stage 1 only after the baseline is recorded.

## Handoff note template

| Field | Value |
| --- | --- |
| From agent |  |
| To agent |  |
| Stage completed |  |
| Status |  |
| Files changed |  |
| Evidence |  |
| Known risks |  |
| Next action |  |
| Stop conditions |  |
