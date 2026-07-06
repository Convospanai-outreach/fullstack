# Migration Manifest Inventory

## Status

Inventory only.
No reconciliation performed.
No migration files moved.
No migration SQL edited.
No database touched.
Production readiness remains NOT_READY.
DB/migration governance remains RED / NEEDS_REPLAN.

## Purpose

This document inventories the existing Prisma migration histories before canonical migration ownership is implemented under `packages/db/prisma`.

It is an evidence base for future reconciliation, not a migration cutover, not a schema change, and not a production DB action.

## Current canonical ownership decision

- Accepted long-term owner: `packages/db/prisma`
- `apps/web/prisma` and `apps/api/prisma` are transitional only
- This PR does not implement that decision
- This PR only prepares the migration manifest evidence

## Inventory summary

| Location | Migration count | Status | Notes |
| --- | ---: | --- | --- |
| `packages/db/prisma/migrations` | 0 | Future canonical owner, no history yet | Directory exists but no tracked `migration.sql` files are present; canonical ownership is still planning-only |
| `apps/web/prisma/migrations` | 25 | Transitional | Richer app-local history; includes auth/onboarding migrations missing from API; still contains destructive patterns |
| `apps/api/prisma/migrations` | 22 | Transitional | Shorter app-local history; matches most shared history with web but lacks three auth/onboarding migrations; still contains destructive patterns |

## Migration list: apps/web

| Sequence | Migration directory | Relative path | SHA256 | Key operations summary | Destructive pattern present? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 20251209110438 | `20251209110438_init` | `apps/web/prisma/migrations/20251209110438_init/migration.sql` | `98a8e18c4cff283b30e52e180049a733f76218e6b6f2494ccbf8c7cb85fc0211` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251209182020 | `20251209182020_dashboard_init` | `apps/web/prisma/migrations/20251209182020_dashboard_init/migration.sql` | `c2ca77d84507e17d0a08c2e63c0aabe5568802756bf33873147e6cc305a43482` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251209193320 | `20251209193320_add_campaign_ai_config` | `apps/web/prisma/migrations/20251209193320_add_campaign_ai_config/migration.sql` | `8fbb640abfc7d8d2c4b8cd7bb3bbf3c852ad4ad5f774ea06d0f96aeaaa37b664` | `ALTER TABLE` | no |  |
| 20251209203145 | `20251209203145_add_credit_transaction` | `apps/web/prisma/migrations/20251209203145_add_credit_transaction/migration.sql` | `59527d649f8c2ecb28a3c7d4932b537cf856b142ab49345e95f2912a9d4a258e` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251213000112 | `20251213000112_init` | `apps/web/prisma/migrations/20251213000112_init/migration.sql` | `c5df326ed806ef85ee993ea81e38d0955590b44eb193d5f8b24d302af6afdc14` | `CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP COLUMN, DROP INDEX` | yes | Destructive review required |
| 20251216120432 | `20251216120432_add_schedules` | `apps/web/prisma/migrations/20251216120432_add_schedules/migration.sql` | `ab17b524c618dc9c0aa211ceedc0654dcb4fa7c672a5ccf46be20c5a1ad65dcc` | `CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP COLUMN, DROP INDEX, DROP CONSTRAINT` | yes | Destructive review required |
| 20251217175210 | `20251217175210_updation171225` | `apps/web/prisma/migrations/20251217175210_updation171225/migration.sql` | `8bde534fc2a0264842ae08c02cc366165050109edc833f9827dce4d483481cd4` | `ALTER TABLE` | no |  |
| 20251217180353 | `20251217180353_add_workflows` | `apps/web/prisma/migrations/20251217180353_add_workflows/migration.sql` | `f075e2f76970e1f610abfa41f0779be19e8ceb4cfe1fe17ba280dfb99e52c064` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217182344 | `20251217182344_add_guardrails` | `apps/web/prisma/migrations/20251217182344_add_guardrails/migration.sql` | `f5ccf2ae78caf96a273e4ebba11e2cccebe0b6799fbc8832ad3a181b38b83f30` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217183808 | `20251217183808_add_audit_logs` | `apps/web/prisma/migrations/20251217183808_add_audit_logs/migration.sql` | `57ab4f892aebb4dc434154af3c4ce7b577623b6eb6de97f2b3b1479bef57cfad` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217185234 | `20251217185234_add_marketplace` | `apps/web/prisma/migrations/20251217185234_add_marketplace/migration.sql` | `0ae9037dd1cc863c8f321bb006c5a511ae6ea8880b1b938ef0c5d0b6c8c099b9` | `CREATE TABLE, CREATE INDEX` | no |  |
| 20251217191823 | `20251217191823_add_adaptive_learning` | `apps/web/prisma/migrations/20251217191823_add_adaptive_learning/migration.sql` | `dde7ee22e245f7ae4225e85fe317a1df778159ac4319ff3e828a320f24f09692` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217192911 | `20251217192911_add_api_keys_v2` | `apps/web/prisma/migrations/20251217192911_add_api_keys_v2/migration.sql` | `a5af7078c983f33a11d0b31f1263b075b616435a3fd3b426a0200927ca857d58` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217195642 | `20251217195642_add_whitelabeling` | `apps/web/prisma/migrations/20251217195642_add_whitelabeling/migration.sql` | `9dd40483784928fbd2cf3de19196c3a8c409182eadbad85354944fde921f6476` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20260208020924 | `20260208020924_add_client_error_logging` | `apps/web/prisma/migrations/20260208020924_add_client_error_logging/migration.sql` | `ddf79828a711dbed35314d44cc254432e1a25be76a3f756c59e80230e8c68956` | `CREATE TABLE, CREATE INDEX` | no |  |
| 20260318115309 | `20260318115309_runtime_contracts` | `apps/web/prisma/migrations/20260318115309_runtime_contracts/migration.sql` | `47078d40d8314e988ac095a52e743fb48e4e6c6a73f5ff19f664f8202529d343` | `CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP TABLE, DROP COLUMN` | yes | Destructive review required |
| 20260522153000 | `20260522153000_add_google_workspace_mailboxes` | `apps/web/prisma/migrations/20260522153000_add_google_workspace_mailboxes/migration.sql` | `ee70265755d5daaaec5537049d43d9bf569ea20bc7939c3191b424546162af48` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no | ConnectedMailbox introduction |
| 20260522170000 | `20260522170000_google_workspace_outreach_foundation` | `apps/web/prisma/migrations/20260522170000_google_workspace_outreach_foundation/migration.sql` | `30836cb14e6738455adbeb2f409dbf99754cf65df9f25359215e080a80b5adc4` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no | ConnectedMailbox downstream references |
| 20260603120000 | `20260603120000_user_invitations` | `apps/web/prisma/migrations/20260603120000_user_invitations/migration.sql` | `d16f08ac358ff8474b3ed48d4ebd19392dc93beffdaa8eb3e3af6e6fbe7d3df6` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no | Web-only auth/onboarding migration |
| 20260604140000 | `20260604140000_edge_runtime_pairing` | `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` | `b64d5d95a8418b42c22e1fd101913f202744fc0611d46b3eb2ef268f5c854c3d` | `CREATE TABLE, ALTER TABLE, CREATE INDEX, DELETE FROM, INSERT INTO, UPDATE` | yes | Known destructive EdgeNode path remains RED |
| 20260608103000 | `20260608103000_edge_session_tokens` | `apps/web/prisma/migrations/20260608103000_edge_session_tokens/migration.sql` | `2aabc54a34c6db1612dafb77ae418b37652103c6d0921267f1f5bbc6155da77f` | `ALTER TABLE, CREATE INDEX` | no | EdgeNode session token follow-up |
| 20260609090000 | `20260609090000_invite_requests` | `apps/web/prisma/migrations/20260609090000_invite_requests/migration.sql` | `85dcc378635e184506d83f8a9b4512e03fc3b4da24026b9e21088ac36f05882b` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no | Web-only auth/onboarding migration |
| 20260609110000 | `20260609110000_clerk_user_mapping` | `apps/web/prisma/migrations/20260609110000_clerk_user_mapping/migration.sql` | `18940c8871640a558f3843801cf4caa809df87822761bda7a84b6bbec3a237cf` | `ALTER TABLE, CREATE INDEX` | no | Web-only auth/onboarding migration |
| 20260612000100 | `20260612000100_lead_channel_status_activity` | `apps/web/prisma/migrations/20260612000100_lead_channel_status_activity/migration.sql` | `157c33a8513c7d651e34dc391ec87418dda1bee73464adf1a9f28c27a6084196` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20260614173000 | `20260614173000_add_llm_usage_actor` | `apps/web/prisma/migrations/20260614173000_add_llm_usage_actor/migration.sql` | `0083cf45e14ed0c03a788fde687994fcf252be782e4de3f9c1887f4a82b8f085` | `ALTER TABLE, CREATE INDEX` | no |  |

## Migration list: apps/api

| Sequence | Migration directory | Relative path | SHA256 | Key operations summary | Destructive pattern present? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 20251209110438 | `20251209110438_init` | `apps/api/prisma/migrations/20251209110438_init/migration.sql` | `98a8e18c4cff283b30e52e180049a733f76218e6b6f2494ccbf8c7cb85fc0211` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251209182020 | `20251209182020_dashboard_init` | `apps/api/prisma/migrations/20251209182020_dashboard_init/migration.sql` | `c2ca77d84507e17d0a08c2e63c0aabe5568802756bf33873147e6cc305a43482` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251209193320 | `20251209193320_add_campaign_ai_config` | `apps/api/prisma/migrations/20251209193320_add_campaign_ai_config/migration.sql` | `8fbb640abfc7d8d2c4b8cd7bb3bbf3c852ad4ad5f774ea06d0f96aeaaa37b664` | `ALTER TABLE` | no |  |
| 20251209203145 | `20251209203145_add_credit_transaction` | `apps/api/prisma/migrations/20251209203145_add_credit_transaction/migration.sql` | `59527d649f8c2ecb28a3c7d4932b537cf856b142ab49345e95f2912a9d4a258e` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251213000112 | `20251213000112_init` | `apps/api/prisma/migrations/20251213000112_init/migration.sql` | `c5df326ed806ef85ee993ea81e38d0955590b44eb193d5f8b24d302af6afdc14` | `CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP COLUMN, DROP INDEX` | yes | Destructive review required |
| 20251216120432 | `20251216120432_add_schedules` | `apps/api/prisma/migrations/20251216120432_add_schedules/migration.sql` | `ab17b524c618dc9c0aa211ceedc0654dcb4fa7c672a5ccf46be20c5a1ad65dcc` | `CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP COLUMN, DROP INDEX, DROP CONSTRAINT` | yes | Destructive review required |
| 20251217175210 | `20251217175210_updation171225` | `apps/api/prisma/migrations/20251217175210_updation171225/migration.sql` | `8bde534fc2a0264842ae08c02cc366165050109edc833f9827dce4d483481cd4` | `ALTER TABLE` | no |  |
| 20251217180353 | `20251217180353_add_workflows` | `apps/api/prisma/migrations/20251217180353_add_workflows/migration.sql` | `f075e2f76970e1f610abfa41f0779be19e8ceb4cfe1fe17ba280dfb99e52c064` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217182344 | `20251217182344_add_guardrails` | `apps/api/prisma/migrations/20251217182344_add_guardrails/migration.sql` | `f5ccf2ae78caf96a273e4ebba11e2cccebe0b6799fbc8832ad3a181b38b83f30` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217183808 | `20251217183808_add_audit_logs` | `apps/api/prisma/migrations/20251217183808_add_audit_logs/migration.sql` | `57ab4f892aebb4dc434154af3c4ce7b577623b6eb6de97f2b3b1479bef57cfad` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217185234 | `20251217185234_add_marketplace` | `apps/api/prisma/migrations/20251217185234_add_marketplace/migration.sql` | `0ae9037dd1cc863c8f321bb006c5a511ae6ea8880b1b938ef0c5d0b6c8c099b9` | `CREATE TABLE, CREATE INDEX` | no |  |
| 20251217191823 | `20251217191823_add_adaptive_learning` | `apps/api/prisma/migrations/20251217191823_add_adaptive_learning/migration.sql` | `dde7ee22e245f7ae4225e85fe317a1df778159ac4319ff3e828a320f24f09692` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217192911 | `20251217192911_add_api_keys_v2` | `apps/api/prisma/migrations/20251217192911_add_api_keys_v2/migration.sql` | `a5af7078c983f33a11d0b31f1263b075b616435a3fd3b426a0200927ca857d58` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20251217195642 | `20251217195642_add_whitelabeling` | `apps/api/prisma/migrations/20251217195642_add_whitelabeling/migration.sql` | `9dd40483784928fbd2cf3de19196c3a8c409182eadbad85354944fde921f6476` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20260208020924 | `20260208020924_add_client_error_logging` | `apps/api/prisma/migrations/20260208020924_add_client_error_logging/migration.sql` | `ddf79828a711dbed35314d44cc254432e1a25be76a3f756c59e80230e8c68956` | `CREATE TABLE, CREATE INDEX` | no |  |
| 20260318115309 | `20260318115309_runtime_contracts` | `apps/api/prisma/migrations/20260318115309_runtime_contracts/migration.sql` | `47078d40d8314e988ac095a52e743fb48e4e6c6a73f5ff19f664f8202529d343` | `CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP TABLE, DROP COLUMN` | yes | Destructive review required |
| 20260522153000 | `20260522153000_add_google_workspace_mailboxes` | `apps/api/prisma/migrations/20260522153000_add_google_workspace_mailboxes/migration.sql` | `ee70265755d5daaaec5537049d43d9bf569ea20bc7939c3191b424546162af48` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no | ConnectedMailbox introduction |
| 20260522170000 | `20260522170000_google_workspace_outreach_foundation` | `apps/api/prisma/migrations/20260522170000_google_workspace_outreach_foundation/migration.sql` | `30836cb14e6738455adbeb2f409dbf99754cf65df9f25359215e080a80b5adc4` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no | ConnectedMailbox downstream references |
| 20260604140000 | `20260604140000_edge_runtime_pairing` | `apps/api/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` | `b64d5d95a8418b42c22e1fd101913f202744fc0611d46b3eb2ef268f5c854c3d` | `CREATE TABLE, ALTER TABLE, CREATE INDEX, DELETE FROM, INSERT INTO, UPDATE` | yes | Known destructive EdgeNode path remains RED |
| 20260608103000 | `20260608103000_edge_session_tokens` | `apps/api/prisma/migrations/20260608103000_edge_session_tokens/migration.sql` | `2aabc54a34c6db1612dafb77ae418b37652103c6d0921267f1f5bbc6155da77f` | `ALTER TABLE, CREATE INDEX` | no | EdgeNode session token follow-up |
| 20260612000100 | `20260612000100_lead_channel_status_activity` | `apps/api/prisma/migrations/20260612000100_lead_channel_status_activity/migration.sql` | `157c33a8513c7d651e34dc391ec87418dda1bee73464adf1a9f28c27a6084196` | `CREATE TABLE, ALTER TABLE, CREATE INDEX` | no |  |
| 20260614173000 | `20260614173000_add_llm_usage_actor` | `apps/api/prisma/migrations/20260614173000_add_llm_usage_actor/migration.sql` | `0083cf45e14ed0c03a788fde687994fcf252be782e4de3f9c1887f4a82b8f085` | `ALTER TABLE, CREATE INDEX` | no |  |

## Migration list: packages/db

`packages/db/prisma/migrations` exists as the selected future canonical owner location, but it currently has no tracked `migration.sql` history.

| Sequence | Migration directory | Relative path | SHA256 or git object hash | Key operations summary | Destructive pattern present? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| n/a | n/a | n/a | n/a | n/a | n/a | No canonical migration history exists yet in `packages/db/prisma/migrations` |

## Cross-history comparison

| Migration directory | Present in apps/web | Present in apps/api | Present in packages/db | Hash match? | Classification | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `20251209110438_init` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251209182020_dashboard_init` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251209193320_add_campaign_ai_config` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251209203145_add_credit_transaction` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251213000112_init` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251216120432_add_schedules` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251217175210_updation171225` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251217180353_add_workflows` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251217182344_add_guardrails` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251217183808_add_audit_logs` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251217185234_add_marketplace` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251217191823_add_adaptive_learning` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251217192911_add_api_keys_v2` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20251217195642_add_whitelabeling` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20260208020924_add_client_error_logging` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20260318115309_runtime_contracts` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20260522153000_add_google_workspace_mailboxes` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20260522170000_google_workspace_outreach_foundation` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20260603120000_user_invitations` | yes | no | no |  | `web-only, missing-from-canonical` | Auth/onboarding history exists only in web |
| `20260604140000_edge_runtime_pairing` | yes | yes | no | yes | `shared-identical, missing-from-canonical` | Contains known destructive EdgeNode DELETE path in web and API |
| `20260608103000_edge_session_tokens` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20260609090000_invite_requests` | yes | no | no |  | `web-only, missing-from-canonical` | Auth/onboarding history exists only in web |
| `20260609110000_clerk_user_mapping` | yes | no | no |  | `web-only, missing-from-canonical` | Auth/onboarding history exists only in web |
| `20260612000100_lead_channel_status_activity` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |
| `20260614173000_add_llm_usage_actor` | yes | yes | no | yes | `shared-identical, missing-from-canonical` |  |

Summary:

- `shared-identical`: 22
- `shared-different`: 0
- `web-only`: 3
- `api-only`: 0
- `packages-db-only`: 0

## Known destructive findings

| Path | Line/context | Pattern | Severity | Current status | Required follow-up |
| --- | --- | --- | --- | --- | --- |
| `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` | Line 49: `DELETE FROM "EdgeNode"` | `DELETE FROM "EdgeNode"` | critical | RED | Design non-destructive replacement or formal quarantine before any blocking scanner mode or production migration |
| `apps/api/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` | Line 49: `DELETE FROM "EdgeNode"` | `DELETE FROM "EdgeNode"` | critical | RED | Design non-destructive replacement or formal quarantine before any blocking scanner mode or production migration |
| `apps/web/prisma/migrations/20260318115309_runtime_contracts/migration.sql` | Line 117: `DROP TABLE "ActivityLog";` | `DROP TABLE` | high | RED | Review whether this destructive contract change is acceptable and capture reconciliation handling in the canonical manifest |
| `apps/api/prisma/migrations/20260318115309_runtime_contracts/migration.sql` | Line 117: `DROP TABLE "ActivityLog";` | `DROP TABLE` | high | RED | Review whether this destructive contract change is acceptable and capture reconciliation handling in the canonical manifest |
| `apps/web/prisma/migrations/20251213000112_init/migration.sql` | Lines 25-27 plus later `DROP INDEX` statements | `DROP COLUMN`, `DROP INDEX` | high | RED | Review historical destructive changes before copying or baselining any app-local history |
| `apps/api/prisma/migrations/20251213000112_init/migration.sql` | Lines 25-27 plus later `DROP INDEX` statements | `DROP COLUMN`, `DROP INDEX` | high | RED | Review historical destructive changes before copying or baselining any app-local history |
| `apps/web/prisma/migrations/20251216120432_add_schedules/migration.sql` | Line 14 plus lines 26-29 | `DROP CONSTRAINT`, `DROP COLUMN`, `DROP INDEX` | high | RED | Review historical destructive changes before copying or baselining any app-local history |
| `apps/api/prisma/migrations/20251216120432_add_schedules/migration.sql` | Line 14 plus lines 26-29 | `DROP CONSTRAINT`, `DROP COLUMN`, `DROP INDEX` | high | RED | Review historical destructive changes before copying or baselining any app-local history |

Existing destructive findings remain RED.
The destructive migration scanner remains advisory until destructive paths are removed or formally quarantined.
This inventory does not approve any destructive SQL.

## Schema ownership notes

- `packages/db/prisma/schema.prisma` exists.
- `apps/web/prisma/schema.prisma` exists.
- `apps/api/prisma/schema.prisma` exists.
- All three schema files expose `generator client` and `datasource db` blocks.
- At a high level, the generator and datasource blocks appear aligned:
  - generator: `prisma-client-js`
  - datasource provider: `postgresql`
- This document does not re-prove full schema equivalence on its own.
- Prior evidence in `docs/audits/read-only-db-schema-drift-proof-2026-07-06.md` already records that the three local schema files matched in the audited local snapshot.

## PR #6 impact

- PR #6 must not be merged as-is.
- Any migration work from PR #6 must be re-evaluated against this manifest.
- ConnectedMailbox drift risk remains a blocker.
- Future Gmail/mailbox migration work must target the canonical ownership path after reconciliation.

## Reconciliation implications

- Do not copy or move migrations yet.
- Do not squash-baseline yet.
- Do not delete app migration histories yet.
- First decide whether canonical `packages/db` history should be:
  1. copied from an existing app history after hash review
  2. reconstructed as a manifest-backed baseline
  3. created through a controlled reconciliation PR
- Any destructive migration must be removed, replaced, or quarantined before blocking scanner mode.

## Required follow-up PRs

1. Canonical manifest approval / cutover design PR
2. EdgeNode non-destructive replacement or quarantine design PR
3. Read-only live DB proof tooling/input PR
4. No-seed readiness audit mode PR
5. CI enforcement PR for canonical migration location
6. Staging dry-run PR
7. Production migration proposal only after approvals

## Not included

- no schema edits
- no migration edits
- no migration movement
- no package changes
- no app code changes
- no DB access
- no env access
- no CI changes
- no production readiness claim

## Verdict

DB/migration governance remains RED / NEEDS_REPLAN until:

- canonical manifest is approved
- destructive EdgeNode path is removed or quarantined
- read-only live DB proof is complete
- staging dry run succeeds
- rollback plan and manual production approval exist
