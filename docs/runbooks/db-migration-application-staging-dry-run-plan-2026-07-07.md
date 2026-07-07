# DB Migration Application And Staging Dry-Run Plan

## Purpose
The connected Supabase production DB is healthy, but the live DB proof shows the expected Prisma/app public schema is missing. This runbook defines the controlled planning path from that BLOCKED proof state toward a staging dry run and, only later, a separately approved production migration proposal.

## Current evidence
- Supabase is reachable and healthy.
- `public._prisma_migrations` is missing.
- `public."User"` is missing.
- `public."UserInvitation"` is missing.
- `public.invite_requests` is missing.
- `public."ConnectedMailbox"` is missing.
- `public."EdgeNode"` is missing.
- `auth.users` is present, but it is Supabase-managed and not equivalent to `public."User"`.
- Live DB proof status is `BLOCKED`.
- No production migration is approved.

## Non-goals
This PR does not:
- run any migration
- create any schema
- push any DB
- pull any DB
- seed any data
- modify `schema.prisma`
- modify any `migration.sql`
- approve production readiness
- unblock PR #6
- approve the EdgeNode `DELETE`
- add any scanner allowlist

## Migration source of truth
- The long-term canonical migration owner is `packages/db/prisma`.
- `packages/db/prisma/migrations` is not yet populated as a canonical migration history.
- `apps/web/prisma` and `apps/api/prisma` remain transitional historical sources.
- Any migration application plan must be based on approved manifest-backed adoption, not blind copy from app-local trees.
- The destructive EdgeNode `DELETE FROM "EdgeNode"` path remains quarantined at the governance level, RED, and unapproved for canonical adoption or execution.

## Required prerequisite order
A. Confirm the canonical migration manifest is approved.  
B. Resolve or explicitly quarantine web-only and app-only migration differences.  
C. Replace or quarantine the destructive EdgeNode path non-destructively.  
D. Prepare the canonical `packages/db/prisma` migration set.  
E. Run the destructive migration scanner.  
F. Run the no-seed readiness audit.  
G. Prepare a disposable staging or preview Supabase DB, or another isolated staging branch.  
H. Apply migrations only in the approved staging or dry-run environment after reviewer sign-off.  
I. Validate the staging app schema through SELECT-only proof.  
J. Validate app boot and build behavior against staging.  
K. Prepare a rollback and backup plan.  
L. Only after explicit production approval, consider production migration execution in a separate PR and runbook.

## Staging dry-run environment requirements
- The first migration application must not use production DB infrastructure.
- Use an isolated staging Supabase project, isolated branch, or disposable database.
- Do not place production service-role secrets in docs, Codex prompts, PRs, or GitHub comments.
- Do not seed production data.
- Do not copy raw PII into staging evidence.
- Use sanitized sample data or no data.
- Record the exact target environment before any human-run execution.
- Prepare a reset or rollback path for the staging target before any migration application.

## Migration application candidate plan
- Use the migration manifest inventory as the evidence base.
- The 22 shared-identical migrations can be candidates for canonical adoption after manifest approval and destructive review.
- The 3 web-only migrations require explicit classification before adoption.
- Destructive migrations require replacement or quarantine decisions before canonical adoption.
- The EdgeNode `DELETE` must not be applied to staging or production as part of the canonical path without explicit replacement or quarantine handling.
- Because live proof shows no `public._prisma_migrations`, the baseline strategy must be explicit and reviewed:
  - either full canonical migration replay into an empty staging DB
  - or a reviewed baseline migration after schema review
- Do not choose the baseline path blindly. Record the chosen option and the approval that allowed it.

## Staging dry-run commands
Placeholder examples only. Do not execute them in Codex.

```bash
# [PLACEHOLDER ONLY - HUMAN OPERATOR AFTER APPROVAL]
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

```bash
# [PLACEHOLDER ONLY - HUMAN OPERATOR AFTER APPROVAL]
npx prisma migrate status --schema packages/db/prisma/schema.prisma
```

```bash
# [PLACEHOLDER ONLY - HUMAN OPERATOR AFTER APPROVAL]
npx prisma validate --schema packages/db/prisma/schema.prisma
```

Rules for any future human-run staging command:
- Do not run these commands in Codex.
- Do not run these commands against production.
- Use only an approved staging `DATABASE_URL` handled outside Codex and GitHub.
- Require reviewer sign-off first.
- Require a backup, reset, or rollback plan first.

## Post-staging validation
After an approved staging dry run, require SELECT-only proof that:
- `public._prisma_migrations` exists
- `public."User"` exists
- `public."UserInvitation"` exists
- `public.invite_requests` exists or is explicitly classified
- `public."ConnectedMailbox"` exists or is explicitly classified
- `public."EdgeNode"` exists or is explicitly classified
- the EdgeNode data preservation decision is documented
- PR #6 remains `BLOCKED` unless ConnectedMailbox shape is proven compatible

## Production approval gate
Production migration can be considered only after:
- the staging dry run passes
- a rollback plan exists
- a backup plan exists
- destructive migration scanner findings are reviewed
- EdgeNode handling is approved
- reviewer sign-off is recorded in the PR or workflow state
- the production target is confirmed
- credentials are handled outside Codex and GitHub
- the execution window is approved

## Fail and blocked conditions
Mark the path `BLOCKED` or keep migration execution `NOT_APPROVED` if any of these remain true:
- canonical migration set is missing
- EdgeNode destructive path is unresolved
- staging DB is unavailable
- migration scanner critical findings are unresolved
- rollback plan is missing
- reviewer sign-off is missing
- proof after staging is missing
- PR #6 dependency remains unresolved
- any secret leakage occurs
- any raw PII exposure occurs

## Current verdict
- Migration execution status: `NOT_APPROVED`
- Staging dry-run status: `NOT_RUN / PENDING`
- Live DB proof status: `BLOCKED`
- Production readiness: `NOT_READY`
- DB/migration governance: `RED / NEEDS_REPLAN`
- PR #6: `BLOCKED`
