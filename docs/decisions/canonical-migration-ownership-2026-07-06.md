# Canonical Migration Ownership Decision

## Status

Accepted for planning.
Implementation pending.
Production readiness remains NOT_READY.

## Decision

Declare the canonical long-term Prisma migration owner as:

`packages/db/prisma`

State clearly:

- `packages/db` is the long-term source of truth for shared database schema and migrations.
- `apps/web/prisma` and `apps/api/prisma` should stop acting as independent migration owners after reconciliation.
- `apps/web` and `apps/api` may continue using generated clients or local schema references temporarily only as a transitional compatibility measure.
- No migration files are moved or edited in this PR.

## Why this decision is needed

This decision is needed because the current repository state still mixes one shared schema target with multiple migration authorities:

- migration histories are split across `apps/web`, `apps/api`, and `packages/db`
- duplicated or divergent ownership increases the risk of inconsistent migration order, missing auth/invite history, and ambiguous rollback paths
- PR #6 remains risky because it overlaps Gmail/mailbox/schema work before migration authority is stabilized
- `ConnectedMailbox` concerns cannot be governed cleanly while migrations are still owned in multiple places
- `20260604140000_edge_runtime_pairing` still contains `DELETE FROM "EdgeNode"` in tracked migration history
- Vercel readiness or deployment success does not prove DB shape correctness
- future production DB changes need one migration authority before they can be reviewed safely

## Options considered

| Option | Description | Pros | Cons | Risk | Decision |
| --- | --- | --- | --- | --- | --- |
| Option A | `packages/db/prisma` as canonical owner | Best fit for a shared DB package; one long-term owner for schema and migrations; cleanest base for future manifest and CI enforcement | Currently has `0` owned migrations; requires reconciliation and cutover planning before it becomes operational | Medium transition risk, lower long-term governance risk | Accepted |
| Option B | `apps/web/prisma` as canonical owner | Closest to the richer current migration history; contains auth/invite migrations missing from API history; could serve as a temporary inventory source during reconciliation | Keeps ownership inside one deployable app instead of the shared DB package; poor long-term governance fit; still leaves later cutover debt | Medium governance risk and transition risk | Rejected as long-term; possible temporary source during reconciliation only |
| Option C | `apps/api/prisma` as canonical owner | Keeps ownership near backend deploy/runtime concerns | Shorter migration history than web; misses web-side auth/invite history; weak fit for shared schema governance | High history and governance risk | Rejected |
| Option D | Continued split ownership | No immediate ownership cutover work | Preserves the exact ambiguity that produced the RED drift proof; weakens every future migration review | High immediate and long-term governance risk | Rejected |

## Transition model

### Phase 0

Current state only. No DB mutation.

### Phase 1

Inventory existing app migrations and create the migration manifest draft.

### Phase 2

Create the canonical migration manifest under `packages/db` and approve that manifest as the handoff artifact for cutover planning.

### Phase 3

Quarantine or replace the destructive `EdgeNode` migration path.

### Phase 4

Add or confirm CI enforcement so new migrations are accepted only in the canonical location.

### Phase 5

Read-only live DB proof tooling and safe input handling.

### Phase 6

No-seed readiness audit mode so production-adjacent verification does not write before auditing.

### Phase 7

Staging dry run.

### Phase 8

Production migration proposal only after manual approval and rollback planning.

## Migration reconciliation rules

- Never delete or rewrite migration history silently.
- Never apply destructive SQL to production without backup, rollback, and manual approval.
- Existing `apps/web` and `apps/api` migration histories must be reconciled into a manifest.
- Overlapping migration names must be hash-compared rather than assumed identical.
- App-only and API-only migrations must be explicitly classified.
- Destructive migrations must be quarantined or replaced before scanner blocking mode is enabled.
- `packages/db` should receive canonical migration ownership only after the manifest is approved.

## EdgeNode destructive migration handling

- The current `DELETE FROM "EdgeNode"` path remains RED.
- This decision does not fix that migration.
- A follow-up PR must design a non-destructive replacement or formal quarantine.
- The destructive migration scanner remains advisory until the known RED path is removed or formally quarantined.

## CI and tooling implications

- The destructive migration scanner remains advisory for now.
- Future CI should fail if new migrations are added outside `packages/db` after cutover.
- Future CI should fail on destructive SQL unless explicitly approved.
- Docs-only PRs should remain lightweight because of the PR #74 guardrails.
- No deployment should be triggered by this `docs/*` branch.

## Impact on PR #6

- PR #6 must not be merged as-is.
- PR #6 must be split or rebased against canonical migration ownership.
- `ConnectedMailbox` schema drift must be resolved before any Gmail/mailbox DB migration is proposed.
- Any migration part of PR #6 must be rewritten as a separate canonical `packages/db` migration plan after reconciliation.

## Read-only live DB proof requirement

Before any production migration:

- obtain safe read-only DB credentials or an approved read-only execution path
- verify actual live tables and columns
- verify Prisma migrations table state
- verify `User`, `UserInvitation`, and `invite_requests`
- verify `ConnectedMailbox` shape
- verify `EdgeNode` shape
- do not print secrets

## Rollback and approval gates

Required approvals before any production migration:

- canonical owner approved
- manifest approved
- destructive path removed or quarantined
- read-only live DB proof complete
- staging dry run complete
- backup and rollback plan documented
- manual production approval recorded

## Not included

This decision record does not include:

- no schema changes
- no migration edits
- no migration execution
- no DB access
- no app code changes
- no PR #6 merge
- no production readiness claim

## Follow-up PRs

1. Phase 1: migration manifest inventory PR
2. Phase 2: canonical `packages/db` migration manifest approval PR
3. Phase 3: EdgeNode non-destructive replacement/quarantine design PR
4. Phase 4: CI enforcement PR for canonical migration location
5. Phase 5: read-only live DB proof tooling/input PR
6. Phase 6: no-seed readiness audit mode PR
7. Phase 7: staging dry-run PR
8. Phase 8: production migration proposal only after approvals
