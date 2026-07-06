# DB Migration Remediation Plan

## Scope

Planning-only response to the RED read-only DB schema drift proof.

This document does not mutate any database, does not create or modify migrations, and does not change any application runtime behavior.

## Current Evidence

Evidence already proven:

- Production health boundary is green. `www.craftmyfunnel.live/api/health?probe=live` and `probe=ready` are already documented as healthy in `docs/audits/production-health-green-proof-2026-07-06.md`.
- Local Prisma schemas are aligned across:
  - `packages/db/prisma/schema.prisma`
  - `apps/web/prisma/schema.prisma`
  - `apps/api/prisma/schema.prisma`
- All three current local schema files use:
  - `provider = "prisma-client-js"`
  - `engineType = "library"`
  - `datasource db { provider = "postgresql" }`
- `npm run db:schema:compare` previously passed and is already recorded in `docs/audits/read-only-db-schema-drift-proof-2026-07-06.md`.
- Migration histories remain divergent:
  - `packages/db/prisma/migrations`: `0`
  - `apps/web/prisma/migrations`: `25`
  - `apps/api/prisma/migrations`: `22`
- `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` and `apps/api/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` both still contain:
  - `CREATE TABLE IF NOT EXISTS "EdgeNodeOrphanAudit"`
  - `INSERT INTO "EdgeNodeOrphanAudit" ...`
  - `DELETE FROM "EdgeNode" ...`
- Local schema files include the auth/onboarding objects that earlier live-DB audits said were missing live:
  - `User.clerk_user_id`
  - `UserInvitation`
  - `invite_requests`
- `ConnectedMailbox` is present in all three local schema files.
- `npm run schema:verify:readonly` was previously blocked because no safe DB URL input was available in the shell.
- `npm run readiness:audit --workspace apps/api` was not run because it routes through a seed step and is not safe for this evidence-only stage.

## Risks Still Open

- Live DB shape remains UNPROVEN in this planning PR. Local schemas cannot be treated as live truth.
- Migration ownership is still split across app-local trees and the shared package is not yet the operational migration owner.
- The `EdgeNode` path is still destructive because it deletes rows before production reconciliation is proven safe.
- Auth/onboarding drift may still exist live even though local schemas now match.
- The repo already contains planning docs that describe safer intent for the `EdgeNode` path, but the committed migration SQL still performs `DELETE FROM "EdgeNode"`. Governance must follow the actual migration SQL, not the intent text.
- Current readiness tooling is not sufficient for this stage:
  - `schema:verify:readonly` depends on safe credential availability
  - `readiness:audit` is not read-only because it seeds first

## Decisions Required

1. Select one canonical migration owner for production governance.
2. Decide whether `packages/db` becomes the long-term owner immediately after reconciliation or only after a transitional freeze.
3. Decide how app-local migration histories will be retired:
   - archive only
   - baseline and freeze
   - copy and reconcile into the canonical owner
4. Decide the exact approval gate for any future migration containing destructive SQL.
5. Decide the required read-only live DB proof package before any production migration proposal can move forward.

## Future PRs Required

1. Docs-only decision PR selecting canonical migration ownership.
2. Tooling PR adding destructive migration scanning and ownership drift enforcement.
3. Migration-design PR for non-destructive `EdgeNode` remediation.
4. Read-only verification tooling PR that supports safe credential input and no-seed audit paths.
5. Staging dry-run PR after live read-only proof is complete.
6. Production migration execution PR only after explicit approvals.

## Actions Explicitly Forbidden In This PR

- No production migration execution.
- No `prisma migrate deploy`.
- No `prisma migrate reset`.
- No `prisma db push`.
- No seed-based readiness audit against production.
- No schema-file edits.
- No migration SQL edits.
- No env or secret changes.
- No `PR #6` merge or partial merge.

## Non-negotiable Safety Rules

- No production migration until the destructive `EdgeNode` path is removed or formally quarantined from production execution.
- No `prisma db push`.
- No `prisma migrate deploy`.
- No seed-based readiness audit against production.
- No `PR #6` merge until schema and migration ownership are resolved.

## Canonical Migration Ownership Decision

Recommendation:

- Choose `packages/db` as the long-term canonical migration ownership location because it is the shared DB package and best matches the current monorepo architecture direction.
- Freeze `apps/web` and `apps/api` as migration owners after reconciliation.
- If the current operational release path is still anchored to `apps/web`, use a phased cutover into `packages/db` instead of pretending the move is already complete.
- Do not execute this ownership change in this PR.

### Decision Table

| Option | Pros | Cons | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Option A: `packages/db` canonical | Matches shared-DB architecture; gives one owner for schema and migrations; reduces future drift between web and API; best base for shared CI enforcement | Currently has `0` migration files; requires reconciliation and operational cutover; cannot be declared canonical by docs alone | Medium transition risk, lower long-term governance risk | Recommended long-term |
| Option B: `apps/web` canonical | Closest to existing richer migration history (`25` dirs); already contains auth/invite migrations absent from API history; may match some current release habits | Keeps migration ownership inside one deployable app instead of the shared DB package; still requires later move or permanent exception handling; API remains secondary | Medium governance risk, medium transition risk | Acceptable only as a transitional stepping stone |
| Option C: keep split ownership | No immediate ownership cutover work | Preserves the exact failure mode that produced the RED drift proof; keeps duplicate histories and future ambiguity; makes CI enforcement weak | High long-term and immediate governance risk | Rejected |

## Destructive EdgeNode Migration Remediation

Safe replacement strategy:

1. Quarantine the current destructive migration path from any production execution decision.
2. Create a non-destructive preflight audit migration design.
3. Preserve potentially orphaned `EdgeNode` rows into an audit table instead of deleting them as part of first-pass reconciliation.
4. Add constraints only after audit evidence confirms the target data is safe.
5. Require a documented backup and rollback plan before any production application.
6. Require a staging or preview dry run before any production approval.
7. Require fresh read-only live DB shape proof before execution.

Pseudocode only, not executable SQL:

```sql
-- PSEUDOCODE ONLY
-- Step 1: inspect orphan candidates
SELECT orphan_edge_nodes;

-- Step 2: preserve candidate rows for manual review
INSERT INTO audit_table_for_orphaned_edge_nodes (...);

-- Step 3: stop if orphan count is non-zero and not explicitly approved
IF orphan_count > 0 THEN block_execution;

-- Step 4: add or validate constraints only after the audit gate passes
ALTER TABLE edge_node ADD CONSTRAINT ...;
```

This PR does not create or modify any migration file.

## Migration History Reconciliation Plan

Problem to reconcile:

- `packages/db`: `0` migrations
- `apps/web`: `25` migrations
- `apps/api`: `22` migrations

Recommended reconciliation sequence:

1. Inventory the full canonical migration file set by name and directory.
2. Compare overlapping migration names and hashes/content between `apps/web` and `apps/api`.
3. Identify app-only migrations:
   - web-only items currently include auth/invite history such as:
     - `20260603120000_user_invitations`
     - `20260609090000_invite_requests`
     - `20260609110000_clerk_user_mapping`
4. Identify whether any API-only migration names exist outside the shared overlap.
5. Decide the canonical-history strategy:
   - copy into `packages/db`
   - baseline/squash into a new canonical starting point
   - archive old app-local histories after canonicalization
6. Define a migration manifest that records:
   - canonical owner
   - approved migration order
   - legacy archived directories
   - destructive migration exceptions, if any
7. Add CI enforcement only after the owner package is selected.

Guidance:

- Do not keep split ownership.
- Do not copy files blindly without comparing content and intent.
- Do not baseline away destructive paths without separately documenting their replacement strategy.

## Read-only Live DB Proof Requirement

Required proof before any production migration proposal:

- Safe read-only DB URL or ephemeral read-only credential.
- No secret printing.
- Queries limited to `information_schema`, `pg_catalog`, and `_prisma_migrations` plus narrowly scoped existence/shape checks.
- Verify `EdgeNode` table shape and current FK/constraint state.
- Verify `User`, `UserInvitation`, and `invite_requests`.
- Verify `ConnectedMailbox` shape.
- Verify `_prisma_migrations` state, including count and latest applied migration names.
- Verify the current production `DATABASE_URL` points to the intended database without printing the value.

Evidence package should include:

- redacted command transcript
- table/column presence results
- migration-table summary
- mismatch summary against the chosen canonical migration owner

## CI/Guardrail Recommendations

- Fail CI if destructive SQL appears in tracked migration files without an explicit reviewed allowlist.
- Fail CI if migration directories diverge after canonical ownership is selected.
- Forbid `prisma db push` and `prisma migrate deploy` in regular PR workflows.
- Add a no-seed, read-only mode for readiness audit tooling.
- Update `schema:verify:readonly` to support safe env-var input without printing secrets.
- Add a manifest check so migration ownership and approved history are machine-verifiable.

## Follow-up PR Sequence

1. docs/decision PR for canonical migration ownership
2. code/tooling PR for destructive migration scanner
3. migration-design PR for non-destructive `EdgeNode` remediation
4. readonly verification tooling PR
5. staging dry-run PR
6. production migration execution only after approvals

## Verdict

RED remains until:

- the destructive migration path is removed or quarantined from production execution
- the canonical migration owner is selected
- safe read-only live DB proof is completed

## Not Included

This plan does not:

- mutate any DB
- create migrations
- apply migrations
- prove Clerk auth flow
- prove Redis isolation
- make the app production ready
- approve `PR #6`
