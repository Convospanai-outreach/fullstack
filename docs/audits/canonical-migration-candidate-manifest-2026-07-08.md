# Canonical Migration Candidate Manifest

## Status
Planning only.
No migration files changed.
No migration execution.
No DB access.
No schema creation.
Production readiness remains NOT_READY.
DB/migration governance remains RED / NEEDS_REPLAN.

## Purpose
This document identifies candidate migration inputs for a future canonical `packages/db/prisma` migration set and an isolated staging-only dry run.

## Current evidence carried forward
- Supabase project is healthy but public app schema is missing.
- `public._prisma_migrations` is missing.
- Expected public app tables are missing.
- `auth.users` exists but is Supabase-managed and is not equivalent to `public."User"`.
- Live DB proof remains `BLOCKED`.
- Staging dry-run remains `NOT_RUN / PENDING`.
- Migration execution remains `NOT_APPROVED`.
- Production migration remains `NOT_APPROVED`.
- Production readiness remains `NOT_READY`.
- DB/migration governance remains `RED / NEEDS_REPLAN`.
- PR #6 remains `BLOCKED`.
- EdgeNode remains `RED`.

## Migration source locations

| Location | Current role | Migration count | Candidate status | Notes |
| --- | --- | ---: | --- | --- |
| `apps/web/prisma/migrations` | Transitional historical source | 25 | `requires-manual-approval` | Contains the richer app-local history, including 22 shared-identical migrations, 3 web-only migrations, and known destructive patterns. |
| `apps/api/prisma/migrations` | Transitional historical source | 22 | `requires-manual-approval` | Contains the 22 shared-identical migrations and known destructive patterns, but no web-only auth/onboarding migrations. |
| `packages/db/prisma/migrations` | Future canonical owner | 0 | `missing-from-canonical` | Canonical owner is accepted, but no tracked migration history exists yet. |

Recorded prior inventory totals:
- `shared-identical`: 22
- `shared-different`: 0
- `web-only`: 3
- `api-only`: 0
- `packages-db-only`: 0

## Candidate classification vocabulary
- `candidate-shared-identical`: eligible candidate input from a shared-identical migration with no currently recorded destructive blocker
- `candidate-web-only-requires-review`: present only in web history and requires explicit classification before any candidate promotion
- `excluded-destructive-red`: blocked from canonical adoption because the recorded destructive history remains RED
- `quarantine-required`: may move only after an explicit quarantine decision is approved and documented
- `replacement-required`: may move only after a non-destructive replacement path is approved and documented
- `not-candidate-yet`: not ready for canonical adoption in the current governance state
- `missing-from-canonical`: absent from `packages/db/prisma/migrations`
- `requires-manual-approval`: reviewable only after explicit reviewer approval because risk or ambiguity remains

## Shared-identical migration candidates

| Migration directory | Present in web | Present in api | Hash status | Candidate class | Notes |
| --- | --- | --- | --- | --- | --- |
| `20251209110438_init` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251209182020_dashboard_init` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251209193320_add_campaign_ai_config` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251209203145_add_credit_transaction` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251213000112_init` | yes | yes | documented-match | `excluded-destructive-red` | Historical destructive `DROP COLUMN` and `DROP INDEX` remain blocked from canonical adoption until replacement-required or quarantine-required handling is resolved. |
| `20251216120432_add_schedules` | yes | yes | documented-match | `excluded-destructive-red` | Historical destructive `DROP CONSTRAINT`, `DROP COLUMN`, and `DROP INDEX` remain blocked from canonical adoption until replacement-required or quarantine-required handling is resolved. |
| `20251217175210_updation171225` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251217180353_add_workflows` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251217182344_add_guardrails` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251217183808_add_audit_logs` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251217185234_add_marketplace` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251217191823_add_adaptive_learning` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251217192911_add_api_keys_v2` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20251217195642_add_whitelabeling` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20260208020924_add_client_error_logging` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20260318115309_runtime_contracts` | yes | yes | documented-match | `excluded-destructive-red` | Historical destructive `DROP TABLE` and `DROP COLUMN` remain blocked from canonical adoption until replacement-required or quarantine-required handling is resolved. |
| `20260522153000_add_google_workspace_mailboxes` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical candidate input, but ConnectedMailbox compatibility proof still remains a separate gate and PR #6 stays blocked. |
| `20260522170000_google_workspace_outreach_foundation` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical candidate input, but ConnectedMailbox compatibility proof still remains a separate gate and PR #6 stays blocked. |
| `20260604140000_edge_runtime_pairing` | yes | yes | documented-match and EdgeNode hash-verified (`d05ac18c728f6440e0e7b5740465a271760a3e98`) | `excluded-destructive-red` | Contains historical `DELETE FROM "EdgeNode"` and remains blocked from canonical adoption until replacement-required or quarantine-required handling is resolved. |
| `20260608103000_edge_session_tokens` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20260612000100_lead_channel_status_activity` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |
| `20260614173000_add_llm_usage_actor` | yes | yes | documented-match | `candidate-shared-identical` | Shared-identical and missing from canonical history. |

## Web-only migration candidates

| Migration directory | Present in web | Present in api | Candidate class | Required review | Notes |
| --- | --- | --- | --- | --- | --- |
| `20260603120000_user_invitations` | yes | no | `candidate-web-only-requires-review` | `requires-live-db-proof` | Auth/onboarding table remains absent from the checked live public schema. |
| `20260609090000_invite_requests` | yes | no | `candidate-web-only-requires-review` | `requires-live-db-proof` | Live proof shows `public.invite_requests` missing; staging and canonical intent still need explicit review. |
| `20260609110000_clerk_user_mapping` | yes | no | `candidate-web-only-requires-review` | `requires-manual-approval` | Touches auth mapping in a live environment where `auth.users` exists but `public."User"` does not. |

## Destructive / RED migrations

| Migration | Path(s) | Destructive pattern | Current status | Candidate treatment | Required resolution |
| --- | --- | --- | --- | --- | --- |
| `20260318115309_runtime_contracts` | `apps/web/prisma/migrations/20260318115309_runtime_contracts/migration.sql`; `apps/api/prisma/migrations/20260318115309_runtime_contracts/migration.sql` | `DROP TABLE "ActivityLog"` plus `DROP COLUMN` destructive contract changes | `RED` | `excluded-destructive-red` | `replacement-required` or `quarantine-required` before canonical adoption or staging dry run; scanner remains advisory; no allowlist approved. |
| `20251213000112_init` | `apps/web/prisma/migrations/20251213000112_init/migration.sql`; `apps/api/prisma/migrations/20251213000112_init/migration.sql` | `DROP COLUMN` plus `DROP INDEX` destructive history | `RED` | `excluded-destructive-red` | `replacement-required` or `quarantine-required` before canonical adoption or staging dry run; scanner remains advisory; no allowlist approved. |
| `20251216120432_add_schedules` | `apps/web/prisma/migrations/20251216120432_add_schedules/migration.sql`; `apps/api/prisma/migrations/20251216120432_add_schedules/migration.sql` | `DROP CONSTRAINT` plus `DROP COLUMN` and `DROP INDEX` destructive history | `RED` | `excluded-destructive-red` | `replacement-required` or `quarantine-required` before canonical adoption or staging dry run; scanner remains advisory; no allowlist approved. |
| `20260604140000_edge_runtime_pairing` | `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql`; `apps/api/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` | `DELETE FROM "EdgeNode"` | `RED` | `excluded-destructive-red` | `replacement-required` or `quarantine-required` before canonical adoption or staging dry run; scanner remains advisory; no allowlist approved. |

## Candidate canonical adoption strategy
- No blind copy.
- No immediate `packages/db` adoption.
- No schema-baseline-only shortcut.
- No production execution.
- The candidate set is for planning only.
- A future implementation PR may create `packages/db/prisma` migration history only after:
  - all shared-identical migrations are hash-confirmed
  - all web-only migrations are classified
  - every RED destructive migration is excluded, replaced, or explicitly quarantined
  - EdgeNode `DELETE` remains excluded until non-destructive replacement or quarantine is approved
  - reviewer sign-off is recorded
  - staging target approval exists

## Empty live DB / missing _prisma_migrations implication
- Because the checked live Supabase public schema has no app tables and no `_prisma_migrations`, a future staging dry run can test full canonical replay against an isolated empty DB.
- This does not authorize production replay.
- Production still requires separate approval, target confirmation, backup and rollback planning, and a dedicated execution PR.

## Staging dry-run prerequisite impact
- This manifest is prerequisite input only.
- It does not authorize staging execution.
- Staging dry run remains blocked until the candidate set is reviewer-accepted, web-only classifications are resolved, every RED destructive migration from the inventory is excluded, replaced, or explicitly quarantined, and reviewer sign-off records a staging-only exception.
- The destructive scanner remains advisory while any RED destructive migration remains unresolved.
- A scanner pass does not approve destructive replay.
- No migration file may be copied or replayed into `packages/db` or staging while RED destructive migrations remain unresolved.
- Reviewer sign-off for any future staging exception must remain narrower than production approval and must not bypass the preservation and rollback gates already documented in the dry-run runbook.

## Not included
- no migration file movement
- no migration file copy
- no migration file edit
- no schema edit
- no DB access
- no SQL execution
- no seed execution
- no migration execution
- no package change
- no workflow change
- no scanner allowlist
- no production readiness claim

## Verdict
- live DB proof: `BLOCKED`
- migration execution: `NOT_APPROVED`
- staging dry-run: `NOT_RUN / PENDING`
- production migration: `NOT_APPROVED`
- production readiness: `NOT_READY`
- DB/migration governance: `RED / NEEDS_REPLAN`
- PR #6: `BLOCKED`
- EdgeNode: `RED`
