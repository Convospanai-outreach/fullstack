# EdgeNode Destructive Migration Handling Decision

## Status
Accepted for planning.
Implementation pending.
No migration SQL changed in this PR.
No database touched.
Production readiness remains NOT_READY.
DB/migration governance remains RED / NEEDS_REPLAN.

## Purpose
This document defines how the known destructive EdgeNode migration must be handled before any canonical `packages/db` migration adoption work begins.

## Known destructive path

| Path | Migration | Destructive SQL | Current status | Notes |
| --- | --- | --- | --- | --- |
| `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` | `20260604140000_edge_runtime_pairing` | `DELETE FROM "EdgeNode"` | RED | Observed review-time file hash: `d05ac18c728f6440e0e7b5740465a271760a3e98`. Destructive statement is at line 49. Future quarantine metadata must recompute and verify the then-current file hash instead of reusing this value blindly. |
| `apps/api/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` | `20260604140000_edge_runtime_pairing` | `DELETE FROM "EdgeNode"` | RED | Observed review-time file hash: `d05ac18c728f6440e0e7b5740465a271760a3e98`. Destructive statement is at line 49. Future quarantine metadata must recompute and verify the then-current file hash instead of reusing this value blindly. |

The destructive SQL remains RED.
This PR does not approve the SQL.
This PR does not allowlist the SQL.
This PR does not edit or remove the SQL.

## Why this is a blocker
- `DELETE FROM` can cause irreversible data loss.
- Live DB shape and EdgeNode table contents are currently UNPROVEN.
- Canonical migration adoption must not copy or bless destructive history blindly.
- The scanner cannot become blocking until known destructive history is resolved or formally quarantined.
- A production migration proposal remains forbidden until read-only proof, staging dry run, backup and rollback planning, and manual approval exist.

## Options considered

| Option | Description | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| A | Leave the destructive migration as-is and adopt it into `packages/db` | Lowest implementation effort | Blindly blesses destructive history, carries forward unresolved RED SQL, and undermines canonical governance | Rejected |
| B | Delete or edit the historical app migration SQL | Removes the current destructive statement from local history | Silently rewrites history, changes audit evidence, and violates the no-migration-edit boundary for this governance phase | Rejected |
| C | Blind allowlist the destructive `DELETE` | Allows the scanner to quiet the known failure | Hides a known RED issue without resolving it and weakens release visibility | Rejected |
| D | Non-destructive replacement design | Preserves data-safety, supports canonical adoption, and creates a reviewable future path | Requires evidence, staging work, and a dedicated implementation phase | Preferred |
| E | Formal quarantine with explicit evidence and temporary advisory scanner status | Keeps the destructive item visible while documenting why it cannot run blindly yet | Is only a governance holding state and does not itself resolve the migration path | Accepted only as an interim governance state |
| F | Defer all EdgeNode handling until production migration proposal | Defers design effort now | Pushes unresolved destructive risk too far downstream and blocks safe canonical adoption planning | Rejected |

Rationale:
- Do not rewrite history silently.
- Do not bless destructive SQL.
- Prefer non-destructive replacement.
- Quarantine can exist only as a clearly documented transitional state, not as approval to execute destructive SQL.

## Preferred decision
The preferred future path is:
1. Treat the existing EdgeNode `DELETE` migration as a RED destructive history item.
2. Do not adopt it blindly into `packages/db`.
3. Design a non-destructive replacement path before canonical migration adoption.
4. Use formal quarantine only as a temporary tracking mechanism if the historical migration must remain in app-local histories during transition.
5. Keep the destructive scanner advisory until the RED path is replaced or formally quarantined with approved evidence.
6. Do not enable blocking scanner mode while this RED item remains unresolved.

## Non-destructive replacement design requirements
The future implementation PR must satisfy the following before any migration file is created or changed.

Required evidence:
- read-only live DB proof of EdgeNode table existence
- row count and data-sensitivity classification, without printing sensitive data
- dependency analysis for EdgeNode relations
- confirmation of expected target EdgeNode schema
- confirmation whether existing EdgeNode rows must be preserved, migrated, archived, or ignored
- rollback plan
- staging dry run result

Design rules:
- do not `DELETE` existing rows by default
- prefer additive schema changes
- prefer idempotent backfill or safe transform
- preserve data unless explicit approval says otherwise
- any destructive action requires backup, rollback, manual approval, and staging proof

## Formal quarantine design
Quarantine is not approval.
Quarantine is a documented state for a known destructive historical migration that must not be executed blindly.

Quarantine record must include:
- exact file path
- exact SQL pattern
- hash of the migration file, recomputed and verified at quarantine time
- reason for quarantine
- live DB proof status
- owner or agent responsible
- required resolution path
- expiration or exit condition
- explicit statement that production execution is not approved

No quarantine allowlist is added in this PR.
A future quarantine PR may add metadata only if approved.
If a scanner allowlist is ever used, it must continue to report the item as known RED or quarantined and must not hide it from release summaries.

## Impact on canonical packages/db adoption
- `packages/db` migration adoption cannot include the destructive EdgeNode `DELETE` as-is.
- Shared-identical migrations remain eligible only after hash confirmation and destructive review.
- The EdgeNode migration must be:
  1. replaced with a non-destructive canonical migration, or
  2. quarantined with explicit evidence and excluded from execution, or
  3. deferred from canonical adoption until live DB proof resolves the correct path
- Phase 5 canonical adoption from PR #80 remains blocked until this condition is met.

## Impact on scanner mode
- scanner remains advisory
- scanner blocking mode must not be enabled while EdgeNode RED remains unresolved
- future blocking mode requires:
  - EdgeNode path removed, replaced, or formally quarantined
  - destructive scanner allowlist policy approved, if applicable
  - CI enforcement PR after RED resolution

## Impact on PR #6
- PR #6 remains blocked.
- Any EdgeNode, Gmail, mailbox, or `ConnectedMailbox` migration work from PR #6 must be separated from app code.
- No migration from PR #6 is approved by this decision.
- `ConnectedMailbox` live DB shape remains a separate proof requirement.

## Future implementation sequence

| Phase | Future PR | Purpose | Allowed changes | Must not do | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| 0 | This docs-only EdgeNode handling decision | Approve the governance path for the known destructive history item | Docs only | No migration SQL edits, no DB access, no scanner allowlist changes | Decision is accepted for planning and RED remains explicit |
| 1 | Read-only live DB proof tooling/input PR | Establish the safe read-only method for proving live EdgeNode table state | Tooling and docs for read-only verification | No write-capable DB commands, no migration execution | Safe read-only proof path is approved |
| 2 | EdgeNode live DB proof report PR | Record the live EdgeNode table evidence needed for replacement or quarantine design | Docs and read-only evidence outputs | No migration edits, no production writes | EdgeNode existence, row handling context, and dependency evidence are documented |
| 3 | EdgeNode non-destructive replacement design PR | Define the exact non-destructive path if live data requires preservation or transformation | Docs and design artifacts | No migration execution, no production DB changes | Non-destructive replacement plan is approved |
| 4 | EdgeNode quarantine metadata PR, only if needed | Record a formal quarantine state if historical app-local SQL must remain during transition | Docs and explicit quarantine metadata only | No silent allowlisting, no approval to execute destructive SQL | Quarantine state is explicit, reviewable, and time-bounded |
| 5 | Canonical `packages/db` adoption implementation PR, only after EdgeNode resolution gate | Adopt canonical migration history only after EdgeNode is resolved by approved replacement or quarantine | May touch migration files only after prior approvals and EdgeNode resolution | No production DB execution | Canonical adoption no longer carries an unresolved blind EdgeNode delete path |
| 6 | Scanner blocking-mode and canonical-location CI enforcement PR | Move from advisory to blocking only after the RED destructive history is resolved | CI, tooling, and docs | Must not enable blocking mode while EdgeNode remains unresolved | Enforcement matches the resolved canonical migration policy |
| 7 | Staging dry run PR | Validate the reviewed migration path safely before any production proposal | Staging-safe verification and rehearsal work | No production migration execution | Staging dry run succeeds and rollback documentation is complete |
| 8 | Production migration proposal PR, only after backup, rollback, and manual approval | Prepare the only phase where production migration execution can be proposed | Proposal docs, approvals, and gated execution plan | No automatic production run without explicit approval | Production proposal is fully reviewable and manually approvable |

Important:
- Phase 5 is the first phase that may touch migration files.
- No phase before Phase 8 may run production migrations.
- Phase 8 is only a proposal unless explicitly approved.

## Acceptance criteria before EdgeNode is considered resolved
- safe read-only live DB proof complete
- EdgeNode table existence and row or data handling understood
- non-destructive replacement or quarantine approach approved
- no blind `DELETE` execution path remains in canonical `packages/db` adoption
- rollback strategy documented
- staging dry run complete before production proposal
- scanner blocking-mode plan updated

## Not included
- no migration SQL edits
- no migration file movement
- no migration file copying
- no Prisma schema edits
- no package changes
- no app code changes
- no CI changes
- no DB access
- no env access
- no scanner allowlist changes
- no production readiness claim

## Verdict
EdgeNode remains RED.
DB/migration governance remains RED / NEEDS_REPLAN.
Production readiness remains NOT_READY.
This document approves the handling strategy only, not execution.
