# Canonical DB Migration Adoption Implementation Prep

## Status
Implementation preparation only.
No DB access.
No SQL execution.
No migration execution.
No seed execution.
No production migration approved.
No staging dry run executed.
Production readiness remains NOT_READY.
DB/migration governance remains RED / NEEDS_REPLAN.

## Purpose
This runbook prepares the repo-side canonical `packages/db` migration adoption path for a future isolated staging dry run.

## Inputs
- canonical migration candidate manifest
- migration manifest inventory
- migration prerequisite decision
- EdgeNode destructive migration handling decision
- staging dry-run runbook
- live DB proof evidence

## Candidate set decision
`CANDIDATE_SET_BLOCKED_BY_RED_DESTRUCTIVE_MIGRATIONS`

The candidate set is not ready for migration file adoption because all RED destructive migrations must be excluded, replaced, or explicitly quarantined first.

## RED destructive migration handling

| Migration | Current handling | Required state |
| --- | --- | --- |
| `20260318115309_runtime_contracts` | excluded from blind adoption | replacement or quarantine required; no destructive SQL approved; no scanner allowlist approved |
| `20251213000112_init` | excluded from blind adoption | replacement or quarantine required; no destructive SQL approved; no scanner allowlist approved |
| `20251216120432_add_schedules` | excluded from blind adoption | replacement or quarantine required; no destructive SQL approved; no scanner allowlist approved |
| `20260604140000_edge_runtime_pairing` | excluded from blind adoption | replacement or quarantine required; no destructive SQL approved; no scanner allowlist approved |

## packages/db adoption strategy
- `packages/db` remains the canonical target.
- No blind copy.
- No schema-baseline-only shortcut.
- No production DB target.
- No staging DB target in this PR.
- Future file movement must preserve hash evidence and manifest traceability.
- Future implementation PR must show exactly which migration files are copied, replaced, skipped, or quarantined.

## Staging dry-run command policy
- Commands are not run in this PR.
- Future commands must run only against an approved isolated staging DB.
- Production `DATABASE_URL` is forbidden.
- Staging `DATABASE_URL` must never be committed.
- Command execution requires reviewer sign-off.

[PLACEHOLDER ONLY - DO NOT RUN IN CODEX]
`npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`

## Required staging proof after future execution
- SELECT-only proof of `public._prisma_migrations`
- SELECT-only proof of expected app tables
- row-count proof where tables exist
- EdgeNode preservation proof compared against a pre-staging baseline
- ConnectedMailbox classification
- PR #6 remains blocked unless proven compatible

## Non-approvals
- no DB access
- no SQL
- no migrations
- no seeds
- no schema creation
- no staging migration
- no production migration
- no EdgeNode DELETE approval
- no scanner allowlist
- no PR #6 unblock
- no readiness claim

## Verdict
- migration file adoption: `NOT_APPROVED / BLOCKED_BY_RED_DESTRUCTIVE_MIGRATIONS`
- migration execution: `NOT_APPROVED`
- staging dry-run: `NOT_RUN / PENDING`
- production migration: `NOT_APPROVED`
- live DB proof: `BLOCKED`
- production readiness: `NOT_READY`
- DB/migration governance: `RED / NEEDS_REPLAN`
- PR #6: `BLOCKED`
- EdgeNode: `RED`
