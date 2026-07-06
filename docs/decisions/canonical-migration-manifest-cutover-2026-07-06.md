# Canonical Migration Manifest Cutover Design

## Status
Accepted for planning.
Implementation pending.
No cutover performed in this PR.
Production readiness remains NOT_READY.
DB/migration governance remains RED / NEEDS_REPLAN.

## Purpose
This document converts the recorded migration inventory into an approved cutover design for moving from the current split migration histories toward `packages/db/prisma` as the canonical Prisma migration owner.

## Inputs
- `docs/decisions/canonical-migration-ownership-2026-07-06.md`
- `docs/audits/migration-manifest-inventory-2026-07-06.md`
- `docs/plans/destructive-migration-scanner-readonly-audit-hardening-2026-07-06.md`
- `docs/audits/read-only-db-schema-drift-proof-2026-07-06.md`
- `docs/plans/db-migration-remediation-plan-2026-07-06.md`

## Current inventory baseline

| Location | Migration count | Role today | Target role | Notes |
| --- | --- | --- | --- | --- |
| `apps/web/prisma/migrations` | 25 | Transitional source history | Transitional until cutover completes | Contains the three current web-only migrations and the known destructive EdgeNode path. |
| `apps/api/prisma/migrations` | 22 | Transitional duplicate/shared history | Transitional until cutover completes | Shared-identical with web for the overlapping 22 migrations. |
| `packages/db/prisma/migrations` | 0 | No tracked migration history yet | Future canonical owner | Canonical owner is approved in principle, but no canonical migration tree exists yet. |

Recorded inventory totals:
- `shared-identical`: 22
- `shared-different`: 0
- `web-only`: 3
- `api-only`: 0
- `packages-db-only`: 0
- destructive findings documented: 8
- EdgeNode `DELETE FROM "EdgeNode"` remains RED

## Cutover decision
Approved planning decision: use a manifest-backed canonical cutover, not a blind file copy and not a destructive squash.

Decision details:
- `packages/db/prisma` becomes the future canonical migration owner.
- Existing app migration histories remain frozen/transitional until reconciliation completes.
- The canonical `packages/db` migration history must be created through a future controlled implementation PR using the approved manifest as its evidence base.
- Shared-identical migrations are eligible for canonical adoption only after hash confirmation.
- Web-only migrations require explicit classification and ownership approval before adoption.
- The destructive EdgeNode migration must be quarantined or replaced before scanner blocking mode or any production migration proposal.
- No production DB migration can occur before read-only live DB proof and a staging dry run.

## Options considered

| Option | Description | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| A | Blind copy `apps/web` migrations into `packages/db` | Fastest apparent path; includes all 25 current web migrations | Blindly carries forward destructive history, approves web-only migrations without classification, and treats current app-local history as canonical without reconciliation | Rejected |
| B | Blind copy `apps/api` migrations into `packages/db` | Avoids the three current web-only migrations | Loses known web-only migration intent, still carries destructive history, and treats transitional API history as canonical without reconciliation | Rejected |
| C | Reconstruct `packages/db` from schema baseline only | Avoids immediate file copying and can start from a clean canonical directory | Discards migration provenance, weakens auditability, and does not explain how current app histories map into the canonical line | Rejected |
| D | Manifest-backed canonical adoption with explicit exceptions | Preserves provenance, allows hash-based adoption of shared-identical migrations, isolates web-only review, and keeps destructive history under explicit review | More planning and bookkeeping before implementation; slower than blind copy | Accepted |
| E | Continue split ownership | Lowest immediate effort | Preserves the current governance failure, keeps ownership ambiguous, and blocks trustworthy enforcement | Rejected |

Rationale:
- `apps/web` has 25 migrations and `apps/api` has 22, with 22 shared-identical and 3 web-only.
- Blind copy would endorse destructive history without review.
- Schema-baseline-only reconstruction would lose migration provenance.
- Split ownership has already been rejected and remains incompatible with controlled production migration governance.

## Approved manifest categories
1. `shared-identical`
   - Eligible for canonical adoption.
   - Must retain hash evidence.
   - No content edits during the adoption PR unless explicitly approved.

2. `shared-different`
   - None currently found.
   - If later found, block cutover until manually reviewed.

3. `web-only`
   - Must be reviewed one by one.
   - May represent web-led schema evolution.
   - Cannot be automatically adopted without classification.

4. `api-only`
   - None currently found.
   - Future findings require explicit review.

5. `packages-db-only`
   - None currently found.
   - Future canonical migrations should appear here after cutover.

6. `destructive`
   - Cannot be silently adopted.
   - Requires quarantine or replacement design.

7. `missing-from-canonical`
   - Current expected state because `packages/db` has 0 migrations.
   - Must be resolved through a future implementation PR.

## Web-only migration handling
The three current web-only migrations require explicit classification before any canonical adoption work:
- web-only does not mean approved
- web-only does not mean rejected
- each web-only migration must be classified in a future implementation plan as one of:
  - `canonical-required`
  - `obsolete`
  - `environment-specific`
  - `replaced by later migration`
  - `requires live DB proof`

No web-only migration is approved for movement in this PR.

## EdgeNode destructive path handling
- EdgeNode `DELETE FROM "EdgeNode"` remains RED.
- This cutover design does not approve the destructive migration.
- A future EdgeNode follow-up PR must choose one of:
  1. non-destructive replacement migration design
  2. quarantine with explicit allowlist and evidence
  3. deprecate or rebuild the table path only after live DB proof
- The scanner remains advisory until this is resolved.
- Blocking scanner mode must not be enabled while known RED destructive history remains unhandled.

## PR #6 handling
- PR #6 remains blocked.
- PR #6 must be split or rebased after canonical cutover design.
- Any Gmail, mailbox, or `ConnectedMailbox` migration must go through `packages/db` after cutover.
- `ConnectedMailbox` shape must be verified against live DB read-only proof before any migration is proposed.
- No migration from PR #6 is approved by this document.

## Future implementation sequence

| Phase | Future PR | Purpose | Allowed changes | Must not do | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| 0 | Current docs-only decision state | Preserve the current evidence baseline and ownership decisions without touching runtime or migration files | Docs only | No schema edits, no migration edits, no DB access | Current state is documented and RED remains explicit |
| 1 | Canonical manifest approval / cutover design - this PR | Approve the manifest-backed cutover strategy and phase sequence | Docs only | No migration movement, no schema edits, no DB access | Strategy accepted for planning |
| 2 | EdgeNode non-destructive replacement/quarantine design PR | Decide how the destructive EdgeNode path will be replaced or quarantined | Docs only | No migration execution, no production DB changes | Approved RED-handling path exists |
| 3 | Read-only live DB proof tooling/input PR | Establish the approved safe path for verifying live DB shape and `_prisma_migrations` state | Tooling/docs for read-only verification | No write-capable DB commands, no production migration execution | Read-only live DB verification path is approved |
| 4 | No-seed readiness audit mode PR | Separate read-only audit capability from seed/write audit behavior | Tooling/docs | No seed/write behavior in the read-only path | Safe no-seed audit mode exists |
| 5 | Canonical `packages/db` migration adoption implementation PR | Create the canonical `packages/db` migration history from the approved manifest and classifications | May copy or adopt migration files only after manifest approval, web-only classification, and destructive-path quarantine/replacement; may update docs/tooling tied to canonical ownership | No production DB execution | Canonical `packages/db` history exists in reviewed form |
| 6 | CI enforcement PR for canonical migration location and blocking scanner mode | Freeze app-local migration ownership and enable stricter enforcement after RED history is handled | CI/tooling/docs | Must not enable blocking destructive scan while known RED findings remain unresolved | Enforcement matches the canonical ownership policy |
| 7 | Staging dry run PR | Validate the reviewed canonical path against staging with rollback planning | Staging-safe verification artifacts and controlled migration rehearsal work | No production migration execution | Staging dry run succeeds with rollback plan documented |
| 8 | Production migration proposal PR | Prepare the only phase where production migration execution can be proposed | Production proposal docs, rollout plan, approvals, and gated execution design | No automatic production run without explicit manual approval | Backup, rollback, approvals, and production proposal are complete |

Important notes:
- Phase 5 is the first phase that may touch migration files.
- Phase 5 must still not run production migrations.
- Phase 8 is the only phase where production migration execution can even be proposed, and only with explicit manual approval.

## Cutover acceptance criteria
Before `packages/db` is treated as canonical in enforcement:
- manifest approved
- shared-identical hashes preserved
- web-only migrations classified
- destructive EdgeNode path handled
- `packages/db` canonical history created or baselined in a reviewed PR
- read-only live DB proof complete
- no-seed readiness audit mode available
- staging dry run complete
- rollback plan documented

## CI enforcement criteria
Future CI should enforce:
- new migrations only under `packages/db/prisma/migrations` after cutover
- `apps/web` and `apps/api` migration directories frozen or blocked after cutover
- destructive scanner blocking mode only after known RED findings are resolved or formally quarantined
- docs-only branches keep lightweight checks

## Not included
- no migration files moved
- no migration files copied
- no migration SQL edited
- no schema edited
- no app code edited
- no DB accessed
- no env accessed
- no CI edited
- no package edited
- no production readiness claim

## Verdict
DB/migration governance remains RED / NEEDS_REPLAN.
This document approves the planning path only.
Production readiness remains NOT_READY.
