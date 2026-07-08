# Neon Staging Migration Dry-run Packet

## Status
Execution packet only.
No migration executed.
No DB mutation.
No schema created.
No seed executed.
No secrets accessed.
Production readiness remains NOT_READY.
DB/migration governance remains RED / NEEDS_REPLAN.

## Purpose
This packet prepares the first controlled Neon staging migration dry run after the Vercel/Neon marketplace integration.

## Current Neon evidence
- Neon project `convospan` is present.
- Vercel-created Neon branch `vercel-dev` exists.
- Metadata-only check found public app tables missing:
  - `public."ConnectedMailbox"`: missing
  - `public."EdgeNode"`: missing
  - `public."User"`: missing
  - `public."UserInvitation"`: missing
  - `public."_prisma_migrations"`: missing
  - `public.invite_requests`: missing
- `neon_auth` managed auth tables are not equivalent to public Prisma app tables.
- This evidence does not approve migration execution.

## Target classification
- Neon staging target candidate: IDENTIFIED
- Neon app schema proof: BLOCKED / MISSING
- Migration execution: NOT_APPROVED
- Staging dry-run: NOT_RUN / PENDING
- Production migration: NOT_APPROVED

## Required preflight before any human-run dry run
1. Confirm exact Neon branch intended for staging dry run.
2. Confirm target is not production.
3. Confirm target can be reset or discarded.
4. Confirm credentials are handled outside Codex/GitHub.
5. Confirm no production PII is copied.
6. Confirm every RED destructive migration is excluded, replaced, or quarantined.
7. Confirm scanner output is reviewed as advisory, not approval.
8. Confirm reviewer sign-off is recorded.
9. Confirm rollback/reset path exists.

## RED destructive migration gate
- `20260318115309_runtime_contracts`
- `20251213000112_init`
- `20251216120432_add_schedules`
- `20260604140000_edge_runtime_pairing`

State:
- none may be replayed blindly
- none may be treated as simple manual approval
- EdgeNode DELETE remains unapproved
- staging dry-run remains blocked until all RED destructive handling is resolved

## Placeholder command packet

[PLACEHOLDER ONLY - DO NOT RUN IN CODEX]
[HUMAN OPERATOR ONLY AFTER REVIEWER SIGN-OFF]
[STAGING NEON DATABASE_URL ONLY - NEVER PRODUCTION]

Example:
```bash
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

- Do not run against production.
- Do not paste `DATABASE_URL` into docs, GitHub, Codex, or chat.
- Do not run until `packages/db` canonical migration set exists and RED destructive migrations are resolved or quarantined.

## Post dry-run proof requirements
- `public._prisma_migrations` exists
- expected public app tables exist
- row counts captured where safe
- EdgeNode preservation compared against pre-dry-run baseline
- ConnectedMailbox classified
- PR #6 remains blocked unless compatible
- no raw PII or secrets in evidence

## Non-approvals
- no DB mutation in this PR
- no SQL execution in this PR
- no migration execution in this PR
- no seed execution in this PR
- no schema creation in this PR
- no production migration approval
- no EdgeNode DELETE approval
- no scanner allowlist
- no PR #6 unblock
- no readiness claim

## Verdict
- Neon staging target candidate: IDENTIFIED
- packages/db adoption: BLOCKED_BY_RED_DESTRUCTIVE_MIGRATIONS
- migration execution: NOT_APPROVED
- staging dry-run: NOT_RUN / PENDING
- production migration: NOT_APPROVED
- live DB proof: BLOCKED
- production readiness: NOT_READY
- DB/migration governance: RED / NEEDS_REPLAN
- PR #6: BLOCKED
- EdgeNode: RED
