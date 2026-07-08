# Migration Prerequisite Decision

## Purpose
This decision record exists because live DB proof remains `BLOCKED` due to missing public app schema and `public._prisma_migrations`, but the team still needs a controlled path toward a staging-only migration dry-run.

## Current state
- Supabase project is healthy.
- Public app schema is missing.
- `public._prisma_migrations` is missing.
- Expected public app tables are missing.
- `auth.users` exists, but it is Supabase-managed and not equivalent to `public."User"`.
- Live DB proof remains `BLOCKED`.
- Staging dry-run remains `NOT_RUN / PENDING`.
- Migration execution remains `NOT_APPROVED`.
- Production migration remains `NOT_APPROVED`.
- Production readiness remains `NOT_READY`.
- DB/migration governance remains `RED / NEEDS_REPLAN`.
- PR #6 remains `BLOCKED`.

## Decision
- This decision does not resolve the live DB proof as `PASS`.
- The `BLOCKED` live DB proof may be used only as evidence that the connected Supabase DB has no app schema, not as readiness.
- The current owner of this blocked prerequisite state is `migration-safety-agent` until a later reviewer sign-off records a narrower staging exception or reassignment.
- Any next movement is limited to docs-only prerequisite resolution and planning.
- Staging DB work remains `NOT_APPROVED` until explicit reviewer sign-off is recorded.
- Production DB work remains `NOT_APPROVED`.

## Migration source prerequisite
Before any staging migration dry-run:
- a canonical migration candidate set must be selected
- `packages/db/prisma` remains the target owner
- `apps/web/prisma` and `apps/api/prisma` histories must be reconciled through manifest-backed adoption
- shared-identical migrations can be candidate input
- web-only and app-only migrations require explicit classification
- no blind copy is allowed
- no baseline-only shortcut is approved without separate review

## EdgeNode prerequisite
- EdgeNode destructive `DELETE` remains `RED`.
- The historical `DELETE FROM "EdgeNode"` path must not be applied as-is.
- EdgeNode handling must be replaced non-destructively or explicitly quarantined before canonical adoption.
- A scanner pass does not approve EdgeNode `DELETE`.
- No scanner allowlist is approved.

## Staging exception gate
A reviewer may later approve a narrowly scoped staging-only dry-run exception only if:
- the target is an isolated staging or disposable Supabase DB
- the production DB is not targeted
- credentials are handled outside Codex and GitHub
- no production data or raw PII is copied
- a reset or rollback path exists
- an EdgeNode preservation baseline is defined
- the canonical migration candidate set is documented
- destructive scanner results are reviewed as advisory
- sign-off is recorded in the PR or `WORKFLOW_STATE.md`

## Production gate
Production migration remains blocked until:
- the staging dry-run passes
- SELECT-only staging proof passes
- EdgeNode preservation proof passes
- a rollback and backup plan exists
- reviewer production approval is recorded
- the production target is confirmed outside Codex
- a separate production execution PR or runbook exists

## Explicit non-approvals
- no DB access approved
- no SQL approved
- no migration approved
- no seed approved
- no schema creation approved
- no production migration approved
- no PR #6 unblock approved
- no production readiness claim approved
- no EdgeNode `DELETE` approved
- no scanner allowlist approved

## Next action
- prepare canonical migration candidate manifest / prerequisite resolution plan
- do not execute staging migration yet
- do not execute production migration

## Verdict
- live DB proof: `BLOCKED`
- migration execution: `NOT_APPROVED`
- staging dry-run: `NOT_RUN / PENDING`
- production migration: `NOT_APPROVED`
- production readiness: `NOT_READY`
- DB/migration governance: `RED / NEEDS_REPLAN`
- PR #6: `BLOCKED`
