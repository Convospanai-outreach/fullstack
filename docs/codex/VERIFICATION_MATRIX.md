# Codex Verification Matrix

This file records evidence gathered during the Vercel/Supabase/Prisma linkage fix.

Every row must be backed by a file path, command output, SQL result, Vercel inspection result, or documented blocker.

## Verdict values

Use only these verdicts:

- PASS
- FAIL
- MISSING
- DUPLICATE
- WRONG_LINKAGE
- SCHEMA_DRIFT
- ENV_DRIFT
- MIGRATION_DRIFT
- RUNTIME_RISK
- PARTIAL
- NEEDS_REPLAN
- SCHEDULED
- BLOCKED_EXTERNAL_ACCESS
- NOT_CHECKED

## Post-PR44 functional readiness reassessment

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Latest main SHA | Current `origin/main` SHA must be known before readiness decisions | `git rev-parse origin/main` returned `6377dd3cc0d3179b58136aad7249cd9355910a20` | PASS | functional-readiness-reassessment-agent | Fetched after PR #44 merged. |
| PR #44 merged | Security sequencing should be on main before treating Stage 12A/12B as canonical | `gh pr view 44` reports `state: MERGED`, `mergedAt: 2026-06-26T07:53:59Z`, merge commit `6377dd3cc0d3179b58136aad7249cd9355910a20` | PASS | functional-readiness-reassessment-agent | Stage 12A/12B sequencing is now present on main. |
| DB-health-green docs commit on main | Commit `2a60a5926275efdbc95eb1df40197371a1004b76` should be on main before using it as main evidence | Ancestry check returned `NOT_ON_MAIN` | FAIL | functional-readiness-reassessment-agent | Commit is on `docs/api-db-health-resolved`, not `main`. |
| Production health documented as 200 on main | Main docs should show `/api/health` and `/api/health?probe=ready` returning 200 before DB readiness is considered resolved | Superseded by the production runtime verification section: both endpoints returned `200` with `checks.database: "up"` after PR #45 merged | PASS | production-runtime-verification-agent | This is infrastructure readiness only, not full app readiness. |
| DB-health-green branch disposition | Decide whether to merge, cherry-pick, or supersede off-main DB-health docs | `docs/audits/production-readiness-next-actions.md` recommends superseding with a fresh verification pass | PASS | functional-readiness-reassessment-agent | Do not merge/cherry-pick stale off-main evidence as-is. |
| API_INTERNAL_ORIGIN / Railway backend origin | Canonical backend API origin should be confirmed before Vercel env changes | Superseded by the production runtime verification section: public Railway origin `https://convospan-api-split-production.up.railway.app` is confirmed and healthy | PARTIAL | production-runtime-verification-agent | Authenticated upstream proxy forwarding still needs smoke proof. |
| Stale Railway required checks | Stale `illustrious-warmth` contexts should not block release | Latest main commit status still includes `illustrious-warmth` success/no-op contexts; required status checks API returns `404 Branch not protected` | PASS | functional-readiness-reassessment-agent | Stale contexts still appear, but are not currently proven required. |
| Functional readiness blockers | DB linkage, schema/migration proof, Prisma drift, Clerk linkage, Redis isolation, health/deep readiness, CI policy, and feature completeness should be clear | `docs/audits/production-readiness-next-actions.md` lists remaining blockers and next 5 actions | FAIL | functional-readiness-reassessment-agent | Product is not production-ready. |
| PR #6 status | PR #6 should remain blocked until schema/env/runtime strategy is stable | Existing workflow state keeps PR #6 blocked; next-actions doc confirms it remains blocked | PASS | functional-readiness-reassessment-agent | Do not touch PR #6. |

## Production runtime verification after API origin update

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Latest main SHA | Current `origin/main` SHA must be known before runtime verification | `git rev-parse origin/main` returned `a827db43697297ed19bc7308b71aefc8c34ab901` | PASS | production-runtime-verification-agent | PR #45 is included in main. |
| PR #45 merged | Functional reassessment should be on main before this follow-up | `gh pr view 45` reports `state: MERGED`, `mergedAt: 2026-06-26T08:45:55Z`, merge commit `a827db43697297ed19bc7308b71aefc8c34ab901` | PASS | production-runtime-verification-agent | Security implementation still not started. |
| Vercel production redeploy | Production deployment should exist after the expected API origin update/redeploy | Vercel project `fullstack-web-xkxn` latest production deployment is `dpl_ARQQj8V2Cua47YgvSiRCaVEo4gZN`, URL `fullstack-web-xkxn-40fi67iv6-convo2026s-projects.vercel.app`, ready state `READY`; GitHub deployment `5207759695` is Production success | PASS | production-runtime-verification-agent | Env values were not inspected or printed. |
| Confirmed Railway public API origin | Use public/custom HTTPS Railway origin, not `.railway.internal` | Latest commit status reports `Success - convospan-api-split-production.up.railway.app`; direct `https://convospan-api-split-production.up.railway.app/health` returned `200` | PASS | production-runtime-verification-agent | Confirmed origin: `https://convospan-api-split-production.up.railway.app`. |
| Production `/api/health` | Web readiness should return healthy after DB env repair | `https://www.craftmyfunnel.live/api/health` returned `200` with `status: "healthy"` and `checks.database: "up"` via SNI/TLS DNS bypass to Vercel edge IP `76.76.21.21` | PASS | production-runtime-verification-agent | DB connectivity only; not schema proof. |
| Production `/api/health?probe=ready` | Explicit readiness should return healthy after DB env repair | `https://www.craftmyfunnel.live/api/health?probe=ready` returned `200` with `status: "healthy"` and `checks.database: "up"` | PASS | production-runtime-verification-agent | DB connectivity only; not schema proof. |
| Production `/api/health?probe=live` | Liveness should remain healthy | `https://www.craftmyfunnel.live/api/health?probe=live` returned `200` with `status: "alive"` | PASS | production-runtime-verification-agent | No downstream I/O. |
| Production `/api/proxy/health` | Should return expected auth gate or valid upstream response depending on current design | `https://www.craftmyfunnel.live/api/proxy/health` returned `401` with `{"error":"Unauthorized"}` | PASS | production-runtime-verification-agent | Expected for unauthenticated request because `/api/proxy/health` is not public-allowlisted. Does not prove authenticated upstream forwarding. |
| Railway `/health` | Public API origin health should respond if endpoint exists | `/health`, `/health?probe=ready`, and `/health?probe=live` returned `200`; readiness body includes `service: "craftmyfunnel-api"` and `checks.database: "up"` | PASS | production-runtime-verification-agent | `/monitoring/health` and `/v1/system/health` returned `503 Server misconfiguration` and are not used as public readiness proof. |
| Vercel runtime logs | No API origin, recursive proxy, DB, or upstream fetch failures after redeploy | Vercel runtime log query for deployment `dpl_ARQQj8V2Cua47YgvSiRCaVEo4gZN` found no matching `API_INTERNAL_ORIGIN`, `recursive proxy`, `database`, or `fetch failed` logs; error/fatal query returned no errors | PASS | production-runtime-verification-agent | One warning: hardware verification failed and app ran software-only during `/api/health`. |
| Production readiness verdict | Product should not be marked ready unless all functional gates pass | `docs/audits/production-runtime-verification-after-api-origin.md` keeps explicit not-production-ready verdict and lists remaining blockers | FAIL | production-runtime-verification-agent | Health green is infrastructure readiness only. |

## Post-PR68/PR70 production health green proof (2026-07-06)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Local Windows hosts override corrected | `craftmyfunnel.live` should resolve to Vercel, not `127.0.0.1` | `Resolve-DnsName craftmyfunnel.live -Type A -Server 8.8.8.8` returned `216.198.79.65` and `64.29.17.65` | PASS | production-health-docs-agent | Earlier curl 500s were local false negatives; see `docs/audits/production-health-green-proof-2026-07-06.md`. |
| `www.craftmyfunnel.live` routing | `www` should resolve through Vercel DNS | `Resolve-DnsName www.craftmyfunnel.live -Type CNAME -Server 8.8.8.8` returned `d6db2f592966d5f8.vercel-dns-017.com` | PASS | production-health-docs-agent | Confirms production routing to Vercel. |
| Apex redirect to www | Apex health probes should redirect to `www` | `curl.exe --ssl-no-revoke -i https://craftmyfunnel.live/api/health?probe=live` returned `308` to `https://www.craftmyfunnel.live/api/health?probe=live`; same for `probe=ready` | PASS | production-health-docs-agent | Redirect is expected and healthy. |
| Production liveness probe | Liveness must return green without downstream I/O | `curl.exe --ssl-no-revoke -i https://www.craftmyfunnel.live/api/health?probe=live` returned `200` with JSON `status: "alive"` and `service: "craftmyfunnel-web"` | PASS | production-health-docs-agent | Health boundary verified. |
| Production readiness probe | Readiness must return green with DB up | `curl.exe --ssl-no-revoke -i https://www.craftmyfunnel.live/api/health?probe=ready` returned `200` with JSON `status: "healthy"` and `checks.database: "up"` | PASS | production-health-docs-agent | Readiness is now proven on the corrected public route. |
| Vercel headers on health responses | Health responses should clearly come from Vercel | `Server: Vercel`, `X-Vercel-Id`, and `X-Matched-Path: /api/health` were present on the `www` health responses | PASS | production-health-docs-agent | Confirms the live responses are Vercel-served. |
| Overall health boundary verdict | Mark only the production health boundary green; keep broader readiness pending | Evidence recorded in `docs/audits/production-health-green-proof-2026-07-06.md` | PASS | production-health-docs-agent | Full production readiness is still pending DB/schema/auth/Redis/security gates. |

## Read-only DB schema drift proof (2026-07-06)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Prisma schema inventory | `packages/db`, `apps/web`, and `apps/api` schema files should be inventoried and compared | `npm run db:schema:compare` reported all three schema files as exact matches with identical line counts and SHA-256 fingerprints | PASS | prisma-drift-agent | Local schema content is aligned in the current repo snapshot. |
| Migration inventory | Migration trees should be inventoried across shared, web, and API locations | `packages/db/prisma/migrations` has `0` SQL migrations; `apps/web/prisma/migrations` has `25`; `apps/api/prisma/migrations` has `22` | MIGRATION_DRIFT | prisma-drift-agent | Migration ownership remains split and divergent even though current schema files match. |
| Destructive EdgeNode migration check | No destructive production-risk SQL should remain in tracked migration history | `20260604140000_edge_runtime_pairing` is present in both app migration trees and contains `DELETE FROM "EdgeNode"` | FAIL | prisma-drift-agent | Treat as blocking until quarantined or replaced through a narrow follow-up plan/PR. |
| Auth/onboarding objects check | Local schema should explicitly account for Clerk/invite objects | All three local schemas include `clerk_user_id` mapping, `UserInvitation`, and `InviteRequest` mapped to `invite_requests` | PASS | prisma-drift-agent | Local presence is proven; live DB presence was not re-verified in this stage. |
| ConnectedMailbox drift check | Local schema should not show unresolved mailbox model drift | `ConnectedMailbox` exists in all three schema files and no local naming divergence was found | PASS | prisma-drift-agent | Live DB confirmation remains pending safe read-only access. |
| Read-only command results | Only safe, non-mutating verification commands should be used | `db:schema:compare` PASS; `schema:verify:readonly` blocked by missing safe DB URL input; `readiness:audit --workspace apps/api` not run because it seeds data first | PARTIAL | prisma-drift-agent | No DB mutation was performed. |
| Final drift verdict | Final verdict should mark only what is proven and keep broader readiness pending | Evidence recorded in `docs/audits/read-only-db-schema-drift-proof-2026-07-06.md`; local schema alignment is proven, but destructive migration history and blocked live DB verification keep the stage red | MIGRATION_DRIFT | prisma-drift-agent | Do not claim full production readiness from this stage. |

## DB migration remediation plan (2026-07-06)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| RED drift proof reviewed | Planning should start from the recorded RED audit rather than reclassifying it | `docs/plans/db-migration-remediation-plan-2026-07-06.md` explicitly starts from `docs/audits/read-only-db-schema-drift-proof-2026-07-06.md` and keeps the verdict red | PASS | prisma-drift-agent | No downgrade to yellow or green. |
| Canonical ownership options documented | Migration ownership options should be documented with a recommendation and rejection rationale | Plan documents Option A `packages/db`, Option B `apps/web`, and Option C split ownership, and recommends Option A long-term | PASS | prisma-drift-agent | Decision still requires approval. |
| Destructive EdgeNode remediation plan documented | The plan should define a non-destructive replacement strategy without changing migration SQL here | Plan documents quarantine, audit-first preservation, staged validation, and rollback requirements for `20260604140000_edge_runtime_pairing` | PASS | migration-safety-agent | Planning only; migration SQL unchanged. |
| Live read-only DB proof requirement documented | Production migration planning should define exact read-only proof requirements before execution | Plan requires safe read-only credentials, redacted output, and verification of `_prisma_migrations`, `EdgeNode`, `User`, `UserInvitation`, `invite_requests`, and `ConnectedMailbox` | PASS | prisma-drift-agent | Live DB shape remains UNPROVEN in this PR. |
| CI guardrails recommended | Planning should define enforcement ideas for destructive SQL and ownership drift | Plan recommends destructive-SQL scanning, ownership drift checks, no-seed audit mode, and safer readonly verification input handling | PASS | ci-gate-agent | Tooling work deferred to follow-up PRs. |
| No DB/app/schema/env changes made | Planning PR must remain docs-only | This PR changes only `docs/plans/db-migration-remediation-plan-2026-07-06.md`, `docs/codex/WORKFLOW_STATE.md`, and `docs/codex/VERIFICATION_MATRIX.md` | PASS | prisma-drift-agent | No app code, schema, migration, env, or secret changes. |
| Production readiness impact | Readiness must remain blocked until remediation is implemented and verified | Plan verdict remains RED and workflow state remains `NEEDS_REPLAN` / `NOT_READY` | FAIL | release-readiness-agent | Planning exists, but remediation is not implemented. |

## Docs-only CI and deployment guards (2026-07-06)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| PR #73 audit baseline SHA corrected | Workflow state should reference a real merged-main baseline commit | `docs/codex/WORKFLOW_STATE.md` baseline was corrected from non-existent `ca5d18f...` to current `origin/main` commit `82a665e7a9f76f93b3ae641e1196aa1e92d276de` | PASS | ci-gate-agent | Verified with `git rev-parse HEAD`, `git cat-file -t HEAD`, and `git rev-parse origin/main`. |
| Undeclared migration-remediation-agent resolved or remapped | Workflow docs should reference only declared agents from `docs/codex/AGENTS.md` | `migration-remediation-agent` references were remapped to `prisma-drift-agent` and `migration-safety-agent`; current docs-only stage uses existing `ci-gate-agent` | PASS | ci-gate-agent | `docs/codex/AGENTS.md` did not need changes. |
| Docs-only change detection added | Required workflows should classify docs-only changes without top-level workflow skipping | `.github/workflows/ci.yml`, `production-gate.yml`, `vercel-parity-build.yml`, and `verify.yml` now start with `Docs-only Change Detection` jobs | PASS | ci-gate-agent | Heavy jobs are gated at the job level. |
| Heavy GitHub Actions jobs gated for docs-only PRs | API strict typecheck, web build, Docker smoke, parity build, and production gate should not run for docs-only change sets | Job-level `if` conditions now skip the expensive jobs when the changed files are docs-only | PASS | ci-gate-agent | Required workflow status should still resolve through the no-op path. |
| Docs-only no-op/success path added | Required workflows should still complete successfully for docs-only PRs | Required workflows now include `Docs-only Validation` jobs with explicit success messaging for docs-only changes | PASS | ci-gate-agent | No-op path avoids pending-check branch protection issues. |
| Vercel docs/* deployment disabled or documented | `docs/*` branches should not create preview deployments | `vercel.json` now disables git deployments for `docs/*` and `docs/**` | PASS | ci-gate-agent | Applies to docs-branch naming convention. |
| Railway unchanged if already path-scoped | Railway should remain untouched unless repo evidence shows docs-only deploy waste | No `railway.json` or `railway.toml` exists in the repo and no Railway config file was changed | PASS | ci-gate-agent | Prior evidence already showed watched-path no-op behavior. |
| No app/schema/migration/env/secret changes | Cost-control PR must not change runtime behavior or DB governance | This PR changes only workflow files, `vercel.json`, the plan doc, and workflow-tracking docs | PASS | ci-gate-agent | No app code, schema, migration, env, or lockfile changes. |
| Production readiness remains NOT_READY | CI cost-control must not be treated as readiness proof | Product readiness remains `NOT_READY` and DB/migration governance remains `NEEDS_REPLAN` / RED | FAIL | release-readiness-agent | Mergeability and compute cost improve; production readiness does not. |

## Canonical migration manifest cutover design (2026-07-06)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Manifest-backed cutover strategy accepted | The cutover design should explicitly adopt a manifest-backed canonical strategy instead of direct migration movement | `docs/decisions/canonical-migration-manifest-cutover-2026-07-06.md` accepts manifest-backed canonical adoption with explicit exceptions and a phased implementation sequence | PASS | prisma-drift-agent | Planning only; no cutover is performed in this PR. |
| Blind copy strategy rejected | Direct copying from app-local migration trees should be rejected at the decision level | The cutover design rejects blind copy from both `apps/web` and `apps/api` into `packages/db` | PASS | prisma-drift-agent | Rejects accidental approval of transitional history. |
| Schema-baseline-only strategy rejected | Reconstructing canonical history from schema alone should be rejected | The cutover design rejects schema-baseline-only reconstruction because it loses migration provenance | PASS | prisma-drift-agent | Provenance preservation remains a core requirement. |
| Split ownership remains rejected | Continued migration ownership split must remain disallowed | The cutover design keeps split ownership rejected and preserves `packages/db/prisma` as the long-term canonical owner | PASS | prisma-drift-agent | Matches the prior ownership decision. |
| Web-only migrations require future classification | The three web-only migrations should stay explicitly unresolved until reviewed | The cutover design keeps web-only migrations unapproved for movement and requires future classification before adoption | PASS | prisma-drift-agent | No silent adoption path is allowed. |
| EdgeNode destructive path remains RED | Known destructive migration history should remain a blocker | The cutover design preserves the RED status for `DELETE FROM "EdgeNode"` and requires quarantine or replacement before blocking scanner mode or production migration proposal | FAIL | migration-safety-agent | This PR does not resolve the destructive path. |
| PR #6 remains blocked | Mailbox-related migration work must stay blocked until canonical governance and live DB proof catch up | The cutover design keeps PR #6 blocked and requires later rebasing or split work against the canonical `packages/db` path | FAIL | prisma-drift-agent | No PR #6 migration approval is granted here. |
| No schema/migration/app/package/workflow/env changes | The decision PR must stay docs-only | This PR changes only `docs/decisions/canonical-migration-manifest-cutover-2026-07-06.md`, `docs/codex/WORKFLOW_STATE.md`, and `docs/codex/VERIFICATION_MATRIX.md` | PASS | prisma-drift-agent | No app code, schema, migration SQL, package, workflow, env, or DB changes. |
| Production readiness remains NOT_READY | The cutover decision must not be treated as production-readiness proof | The cutover design explicitly keeps DB/migration governance `RED / NEEDS_REPLAN` and overall product readiness `NOT_READY` | FAIL | release-readiness-agent | Planning path only; no remediation is implemented. |

## Destructive migration scanner and read-only audit hardening (2026-07-06)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Destructive migration scanner added | Repo should have a fail-closed scanner for tracked Prisma migration SQL | `scripts/readiness/scan-destructive-migrations.ts` scans tracked `migration.sql` files under `apps/web`, `apps/api`, and `packages/db`, reports file path/line/pattern/excerpt/severity, and exits non-zero on unallowlisted findings | PASS | migration-safety-agent | Uses only local filesystem and `git ls-files`; no DB or env access. |
| EdgeNode destructive DELETE detected | The current known RED migration finding should still be surfaced, not hidden | The scanner detects `DELETE FROM "EdgeNode"` in `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql` and the matching API migration file | FAIL | migration-safety-agent | Existing RED remains active until the destructive path is quarantined or replaced. |
| CI integration added as advisory or blocking | Scanner should be integrated into a lightweight required workflow with state clearly declared | `.github/workflows/verify.yml` now runs `Destructive Migration Scan (Advisory)` for non-docs changes and keeps docs-only PRs on the no-op path | PASS | ci-gate-agent | Advisory mode is intentional because current `main` already contains known destructive findings. |
| Read-only audit safety documented | Repo docs should clearly distinguish read-only verification from seed/write flows | `docs/plans/destructive-migration-scanner-readonly-audit-hardening-2026-07-06.md` documents that `db:schema:compare` is safe, `schema:verify:readonly` still needs safe DB input, and `apps/api` `readiness:audit` is not safe for production evidence because it seeds first | PASS | migration-safety-agent | No DB behavior changed in this PR. |
| No migrations edited | Tooling PR must not modify tracked migration SQL | No `migration.sql` files were edited; the scanner only reads tracked migration files | PASS | migration-safety-agent | Existing migration history remains untouched. |
| No DB touched | Tooling PR must not connect to or mutate any DB | Scanner and workflow wiring are file-system only, and no DB commands were run in this stage | PASS | migration-safety-agent | Safe local validation is limited to scanner execution. |
| Production readiness remains NOT_READY | Safety tooling must not be treated as schema remediation or launch proof | Product readiness remains `NOT_READY` and DB/migration governance remains `RED / NEEDS_REPLAN` | FAIL | release-readiness-agent | This PR improves guardrails only. |

## Canonical migration ownership decision (2026-07-06)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| `packages/db` selected as long-term canonical owner | One long-term Prisma migration owner should be chosen for planning | `docs/decisions/canonical-migration-ownership-2026-07-06.md` accepts `packages/db/prisma` as the long-term canonical owner | PASS | prisma-drift-agent | Decision only; no migration ownership cutover is implemented in this PR. |
| Split migration ownership rejected | Continued split ownership should be explicitly rejected | Decision record rejects continued `apps/web` + `apps/api` + `packages/db` ownership because migration histories remain split (`packages/db`: `0`, `apps/web`: `25`, `apps/api`: `22`) | PASS | prisma-drift-agent | Governance remains red until reconciliation is implemented. |
| `apps/web` and `apps/api` marked transitional only | App-local schema references and migration roles should be temporary after reconciliation | Decision record marks `apps/web` and `apps/api` as transitional compatibility measures only, not long-term migration authorities | PASS | prisma-drift-agent | No rewiring or file movement occurs in this PR. |
| EdgeNode destructive path remains RED | Canonical ownership decision must not hide the known destructive migration issue | Decision record keeps `DELETE FROM "EdgeNode"` in `20260604140000_edge_runtime_pairing` explicitly RED and unresolved | FAIL | migration-safety-agent | Separate non-destructive replacement/quarantine work is still required. |
| PR #6 remains blocked | Broad PR #6 should stay blocked until migration governance is reconciled | Decision record states PR #6 must not merge as-is and any migration portion must be rewritten as canonical `packages/db` work after reconciliation | PASS | pr-strategy-agent | No PR #6 changes were made. |
| No schema/migration/app/env changes | Docs-only decision PR must not change runtime or DB assets | This PR changes only the decision record plus `WORKFLOW_STATE.md` and `VERIFICATION_MATRIX.md` | PASS | prisma-drift-agent | No app, schema, migration SQL, package, workflow, env, or secret changes. |
| Production readiness remains NOT_READY | Ownership decision must not be treated as readiness proof | Product readiness remains `NOT_READY` and DB/migration governance remains `RED / NEEDS_REPLAN` | FAIL | release-readiness-agent | The decision clarifies governance; it does not resolve it. |

## Migration manifest inventory (2026-07-06)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Migration histories inventoried | Existing migration trees should be counted before reconciliation planning | `docs/audits/migration-manifest-inventory-2026-07-06.md` records `packages/db`: `0`, `apps/web`: `25`, `apps/api`: `22` tracked `migration.sql` files | PASS | prisma-drift-agent | Inventory only; no migration ownership cutover performed. |
| `apps/web` migration list recorded | Web migration history should be listed with hashes and operation summaries | Audit records all `25` web migration directories with SHA256, relative path, summary, and destructive flag | PASS | prisma-drift-agent | Includes the three web-only auth/onboarding migrations. |
| `apps/api` migration list recorded | API migration history should be listed with hashes and operation summaries | Audit records all `22` API migration directories with SHA256, relative path, summary, and destructive flag | PASS | prisma-drift-agent | API history is shorter than web and lacks three auth/onboarding migrations. |
| `packages/db` migration status recorded | Future canonical owner location should be explicitly documented even if empty | Audit records that `packages/db/prisma/migrations` exists but has `0` tracked `migration.sql` files | PASS | prisma-drift-agent | Canonical ownership remains planning-only until reconciliation. |
| Cross-history comparison recorded | Shared vs app-only history should be hash-classified before any cutover design | Audit records `22` shared-identical migrations, `0` shared-different, `3` web-only, `0` API-only, `0` packages-db-only | PASS | prisma-drift-agent | All current tracked history is still missing from the future canonical location. |
| Destructive EdgeNode finding retained as RED | Inventory must keep the known `EdgeNode` delete path blocking | Audit records `DELETE FROM "EdgeNode"` at line `49` in both `apps/web` and `apps/api` `20260604140000_edge_runtime_pairing` migrations and keeps the status RED | FAIL | migration-safety-agent | Inventory does not approve or soften destructive SQL. |
| No schema/migration/app/package/workflow/env changes | Inventory PR must remain docs-only | This PR changes only the migration inventory audit plus `WORKFLOW_STATE.md` and `VERIFICATION_MATRIX.md` | PASS | prisma-drift-agent | No schema files, migration SQL, app code, package files, workflows, env, or secrets were changed. |
| Production readiness remains NOT_READY | Inventory evidence must not be treated as reconciliation or launch proof | Product readiness remains `NOT_READY` and DB/migration governance remains `RED / NEEDS_REPLAN` | FAIL | release-readiness-agent | Inventory improves reconciliation evidence only. |

## Authenticated proxy verification execution (2026-06-27T17:20+05:30)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Latest main SHA | Current `origin/main` SHA must be known | `428bae6fab693196b9e0a3d309446049607f8963` | PASS | production-runtime-verification-agent | PRs #49 and #50 are merged. |
| PR #47 merged | PR #47 should be on main | Merged and pulled | PASS | production-runtime-verification-agent | Green health checks recorded on main. |
| PR #48 merged | PR #48 should be on main | Merged and pulled | PASS | production-runtime-verification-agent | Authenticated proxy verification plan on main. |
| Authenticated proxy plan | Create safe read-only protocol and boundaries | Created `docs/audits/authenticated-proxy-verification-plan.md` | PASS | production-runtime-verification-agent | Does not mutate data or bypass auth. |
| Authenticated proxy forwarding | Verify proxy routes authenticated calls successfully | Verified page-driven authenticated proxy requests route to backend returning valid responses | PASS | production-runtime-verification-agent | Verified `/setup`, `/intel`, `/inbox`, `/campaigns`, `/calendar`, `/notifications`, `/audit-logs`, `/billing` in `docs/audits/authenticated-proxy-verification.md` |
| Unauthenticated proxy behavior | Verify middleware block | Unauthenticated `/api/proxy/health` returns `401 Unauthorized` | EXPECTED_AUTH_GATE | production-runtime-verification-agent | Expected by middleware design. |
| Overall product readiness | Remain not ready | Blocker list remains active | NOT_READY | production-runtime-verification-agent | Infrastructure and proxy green; schema and security gates pending. |

## Post-PR52 production regression audit (2026-06-29T12:58+05:30)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Latest main SHA | Commit `806be69` should be on main | Verified `806be69526d17db455a19b7626c06a7fad95f8dd` | PASS | production-runtime-verification-agent | PR #52 is merged. |
| Vercel Production deployment | Latest main deployed on Vercel | Verified deployment `dpl_hzinjinz7...` completed successfully | PASS | production-runtime-verification-agent | Custom domain serves latest main. |
| Railway API deployment | Latest main deployed on Railway | Verified deployment `airy-balance / production` completed successfully | PASS | production-runtime-verification-agent | API and database connectivity up. |
| Production health APIs | Health endpoints return 200 OK | Verified `/api/health`, `/api/health?probe=ready`, and Railway `/health` return database up | PASS | production-runtime-verification-agent | All health indicators are green. |
| Dashboard pages smoke | core pages render successfully | Checked `/dashboard`, `/campaigns`, `/leads`, `/workflows`, `/analytics` non-mutating routes | PASS | production-runtime-verification-agent | Clerk auth gate restricts unauthenticated access. |
| Proxy routing stability | Authenticated proxy routing remains intact | Web proxy routes GETs to Railway API successfully | PASS | production-runtime-verification-agent | Confirmed post-merge. |
| Overall product readiness | Remain not ready | Blocker list remains active | NOT_READY | production-runtime-verification-agent | Verified regression-free, but blocked on security and schema sync. |

## Supabase schema/migration proof planning (2026-06-29T14:10+05:30)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Latest main SHA | Commit `04b64d1` should be on main | Verified `04b64d1abe445fd0f83fa2d372e575d9bd1bb4ee` | PASS | production-runtime-verification-agent | PR #53 is merged. |
| Supabase schema proof plan | Create safe read-only plan and boundaries | Created `docs/audits/supabase-schema-migration-proof-plan.md` | PASS | production-runtime-verification-agent | Non-mutating diagnostic plan created. |
| Schema proof checks | Status and drift verification commands defined | Commands target migration status and schema diff status against web Prisma | PASS | production-runtime-verification-agent | Ready for execution. |
| Remaining blockers | Remain not ready | Blocker list remains active | NOT_READY | production-runtime-verification-agent | Sync and isolation blockers pending. |

## Clerk user/team linkage verification planning (2026-06-29T14:45+05:30)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Latest main SHA | Commit `06d1ee8` should be on main | Verified `06d1ee84551bec623f31b69933a4d6f2b8bfc4fa` | PASS | production-runtime-verification-agent | PR #54 is merged. |
| Clerk linkage verification plan | Create safe read-only plan and boundaries | Created `docs/audits/clerk-user-team-linkage-verification-plan.md` | PASS | production-runtime-verification-agent | Non-mutating diagnostic plan created. |
| Browser credential smoke steps | Tester credentials and pages defined | Credentials `tester@craftmyfunnel.live` and core routes checklist mapped | PASS | production-runtime-verification-agent | Ready for execution. |
| Safe DB linkage checks | Read-only SQL queries defined | SELECT queries targeting User, TeamMember, and Team mapped | PASS | production-runtime-verification-agent | Ready for execution. |
| Clerk user/team linkage | Verify Clerk identity maps to database tenant structure | Not executed yet | NEEDS_VERIFICATION | production-runtime-verification-agent | Scheduled for execution. |
| Remaining blockers | Remain not ready | Blocker list remains active | NOT_READY | production-runtime-verification-agent | Supabase migration proof, Redis isolation, and security gates pending. |

## Supabase schema/migration proof execution scripts (2026-06-29T15:45+05:30)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Latest main SHA | Commit `33b46cc` should be on main | Verified `33b46cc598007ea45f1b51fc3a5a8a1ff14ebbc8` | PASS | production-runtime-verification-agent | PR #55 is merged. |
| Verification scripts added | check-db-shape and check-migration-status created | Scripts added to `scripts/readiness/` directory | PASS | production-runtime-verification-agent | Safe, read-only TS scripts. |
| Production confirmation flag | Require `--allow-production-readonly` for remote targets | Checked URL checks and process args checking in scripts | PASS | production-runtime-verification-agent | Prevent accidental execution against production. |
| Supabase schema/migration proof | Executed script check output confirmed | Execution results document added to `docs/audits/` | EXECUTION_SCRIPT_ADDED | production-runtime-verification-agent | Awaiting manual run against target DBs. |
| Remaining blockers | Remain not ready | Blocker list remains active | NOT_READY | production-runtime-verification-agent | Redis isolation and Stage 12A gates pending. |

## Vercel linkage matrix

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Project ID | prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8 | Connector returned `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` | PASS | vercel-linkage-agent |  |
| Project name | fullstack-web-xkxn | Connector returned `fullstack-web-xkxn` | PASS | vercel-linkage-agent |  |
| Root directory | apps/web or documented equivalent | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Linked repo | Convospanai-outreach/fullstack | Deployment metadata links to `Convospanai-outreach/fullstack` | PASS | vercel-linkage-agent |  |
| Production branch | main or documented release branch | Production checks for `www.craftmyfunnel.live` identify environment `production`, branch `main`, deployment `5147697018` | PASS | approval-readiness-agent | Codex branch previews are not production |
| Latest deployment commit | should match intended release | Latest inspected deployment was `READY` from `codex/db-linkage-swarm-orchestration` commit `ef4eaf27d2796671927dfc68a082731547fd1d04`; recent production deployment from `main` commit `4367d7bc374d4a6db9151b00bc40078fca1e2416` | RUNTIME_RISK | vercel-linkage-agent | Vercel READY is not launch readiness |
| Commit `3b2d7069` Vercel deployment failure | Root cause identified and corrected before continuing | Deployment `dpl_ABSFvNfhHYfePwfijM8sgR9xrxBe` failed TypeScript on `apps/web/src/scripts/verify-schema-readiness.ts` importing `pg` without declarations; verifier moved out of web source | PASS | vercel-linkage-agent | New deployment still must be observed after commit/push |
| Commit `07d6736f` Vercel deployment | Preview build should pass before Phase 3 | Deployment `dpl_8dfuT5xwLDeoHfdxQfeuqh6qTFGU` for commit `07d6736f72989a1db8e854ee38c793cc9fb437a2` is `READY` | PASS | vercel-linkage-agent | Vercel READY still does not prove DB/auth/cache readiness |
| Commit `fc500fa7` Vercel deployment | Phase 3 build should pass | Confirmed `READY` by user on 2026-06-18; no TypeScript or build errors reported | PASS | orchestrator | Phase 4 work begins on top of this green commit |
| Commit `6d012ea` Vercel deployment | Approval docs commit should be green before live URL verification | Deployment `dpl_5S2oME2vqrWV1NdKrhsKjqZNXCF7` for commit `6d012ea382ec324cdb73bcdcff9c5d00a843d795` is `READY` | PASS | approval-readiness-agent | Checked before public URL verification |
| Commit `74423bc` Vercel deployment | Public-route/email fix commit should be green before live approval recheck | Deployment `dpl_J8U8CjWQtgZV74erY8Mhg3teYjCW` for commit `74423bcb39184754a13f7cc43d4f9c3ebe2a70ec` is `READY` | PASS | approval-readiness-agent | Checked before live custom-domain recheck |
| Commit `9788d84` Vercel deployment | Latest requested cinematic/proxy/studio commit should have Vercel success | GitHub commit status API returned overall `success`; Vercel context description `Deployment has completed`; GitHub deployment `5138739382` status `success`, preview URL `https://fullstack-web-xkxn-jifhkvhbk-convo2026s-projects.vercel.app` | PASS | approval-readiness-agent | Preview URL is Vercel SSO-protected (`401`), so public content comparison used custom domain |
| Commit `ef4eaf` Vercel deployment | Latest Codex docs/alignment head should have Vercel success before handoff | GitHub commit status API returned overall `success`; Vercel context description `Deployment has completed`; GitHub deployment `5148221224` status `success`, preview URL `https://fullstack-web-xkxn-dftv0obdl-convo2026s-projects.vercel.app` | PASS | approval-readiness-agent | Preview-only deployment; does not prove custom-domain production behavior |
| Commit `e14806c` Vercel deployment | Latest main after PR #35 merge should have Vercel success | Combined commit status for `e14806ca01439219fa3f93214acd07b1d3a9d042` returned Vercel `success` | PASS | post-pr35-release-gate-agent | Vercel green does not prove overall release readiness |
| Commit `6d01210` Vercel deployment | Latest main after PR #39 merge should have Vercel success | Commit status for `6d012102ebfeff47e8a95cf72fda5955a76aee1e` returned Vercel `success` and deployment completed | PASS | post-pr39-production-smoke-agent | Vercel green does not prove DB/API readiness |
| Commit `34c3339` Vercel deployment | Latest main after PR #40 merge should have Vercel success | Commit status for `34c3339c280e0922567cc203b9edd3c435c073c1` returned Vercel `success` and deployment completed | PASS | api-origin-health-readiness-agent | Vercel green does not prove DB/API readiness |
| Commit `d3bcbb3` Vercel deployment | Latest main after PR #41 merge should have Vercel success | Commit status for `d3bcbb3a12d7c184c0258cfaa0ea8cf5ab6fa8e8` returned Vercel `success` and deployment completed | PASS | api-origin-health-readiness-agent | Vercel green does not prove DB/API readiness |
| Production deployment alignment | Custom domain should serve intended production branch/fix | Runtime checks show `www.craftmyfunnel.live` serving production branch `main` (commit `4367d7bc374d4a6db9151b00bc40078fca1e2416`); current Codex head `ef4eaf` is Preview only | RUNTIME_RISK | approval-readiness-agent | Safe path is PR/cherry-pick minimal fix to `main` after checks |
| Custom domain alias for `9788d84` | `www.craftmyfunnel.live` should serve latest requested public-route/content behavior | Public HTTPS checks via SNI/TLS DNS bypass show `/`, `/funnel`, and approval pages returning `200`; `/funnel` route chunk is present; approval routes no longer redirect to login or serve old email values | PASS | approval-readiness-agent | Exact deployment SHA is not exposed by response headers |
| Apex domain redirect | `craftmyfunnel.live` should route to canonical production host | `HEAD https://craftmyfunnel.live/` via SNI/TLS DNS bypass returned `308` to `https://www.craftmyfunnel.live/` | PASS | approval-readiness-agent | Local DNS maps apex to `127.0.0.1`; bypass used `76.76.21.21` |
| DATABASE_URL production | expected Supabase ref izqcycslipmbgdwgajvu; runtime/pooler allowed | Env listing unavailable via connector; local Vercel CLI scope failed | BLOCKED_EXTERNAL_ACCESS | vercel-linkage-agent | host/ref only; no secret |
| DIRECT_URL production | expected direct host db.izqcycslipmbgdwgajvu.supabase.co | Env listing unavailable via connector; local Vercel CLI scope failed | BLOCKED_EXTERNAL_ACCESS | vercel-linkage-agent | host/ref only; no secret |
| Preview DB isolation | preview must not write prod DB unless explicitly allowed | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Redis production | present if cache/queue enabled | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent | host only; no secret |
| Redis preview isolation | preview must not share prod namespace | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Clerk vars | present when Clerk auth enabled | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent | values must be redacted |
| API_INTERNAL_ORIGIN | present if web calls API internally | 2026-06-26T16:44+05:30: public Railway origin `https://convospan-api-split-production.up.railway.app` confirmed and healthy; unauthenticated `/api/proxy/health` returns expected `401`. Authenticated verification plan created. | PARTIAL | production-runtime-verification-agent | Public origin is confirmed, but authenticated upstream proxy forwarding still needs smoke proof as planned. |

## Supabase schema matrix

| Object | Expected by app | Actual Supabase | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| vector extension | Required if Lead.embedding is vector | Installed extension `vector` found | PASS | supabase-inspector | Live `Lead.embedding` is currently text |
| _prisma_migrations | Present and latest expected migration applied | Present with 17 rows | MIGRATION_DRIFT | supabase-inspector | Local web has 25 migrations; API has 22 |
| Lead.embedding | Must match canonical schema | Live column is nullable `text`; all three local schemas are unified at `String?` | PASS | prisma-drift-agent | Unified at String? Option B accepted. |
| Canonical schema ownership | Should move to shared DB package | `packages/db/prisma/schema.prisma` skeleton added as starting snapshot copied from `apps/web/prisma/schema.prisma` | PASS | orchestrator | App-local schemas remain in place and are not wired to shared package yet |
| Email | Must include final canonical email fields | NOT_CHECKED | NOT_CHECKED | supabase-inspector |  |
| ConnectedMailbox | Must match canonical mailbox model | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 conflict risk |
| EmailEvent | Prefer canonical event table | NOT_CHECKED | NOT_CHECKED | supabase-inspector | Duplicate with EmailActivityLog risk |
| EmailActivityLog | Should not duplicate EmailEvent unless documented | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 risk |
| TrackedLink | Prefer canonical link tracking table | NOT_CHECKED | NOT_CHECKED | supabase-inspector | Duplicate with EmailTrackedLink risk |
| EmailTrackedLink | Should not duplicate TrackedLink unless documented | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 risk |
| SuppressionEntry | Must match final canonical shape | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 shape conflict risk |
| WaitlistRequest | Present only if feature requires it | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 adds it |
| User | Required for app auth linkage | Table exists, but `clerk_user_id` is missing | SCHEMA_DRIFT | supabase-inspector | Clerk sync depends on `clerkUserId` |
| TeamMember | Required for tenant membership | Table and key columns exist | PASS | supabase-inspector |  |
| UserInvitation | Required if invite gating enabled | Missing live | MISSING | supabase-inspector | Local web migration exists |

## Four-way Prisma drift matrix

| Model/table | apps/web schema | apps/api schema | Actual Supabase | PR #6 expectation | Verdict | Fix strategy |
| --- | --- | --- | --- | --- | --- | --- |
| Lead.embedding | `String?` | `String?` | Live nullable `text` | PR #6 expectation unresolved | PASS | Option B applied across all schemas. |
| ConnectedMailbox | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| Email | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| EmailEvent / EmailActivityLog | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| TrackedLink / EmailTrackedLink | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| SuppressionEntry | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| WaitlistRequest | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| UserInvitation | Present in web schema | Present in API schema | Missing live | PR #6 broad auth/mailbox work overlaps | PASS | Added to API schema; live migration is in future phase. |
| Shared DB schema snapshot | Same as current approved starting candidate | `packages/db/prisma/schema.prisma` copied from `apps/web/prisma/schema.prisma`; compare script added | PASS | orchestrator | Snapshot only; no migrations generated |
| Lead.embedding canonical type | Must be resolved before any migration | Option B accepted (CTO, 2026-06-18): `packages/db` and `apps/web` changed to `String?`; `apps/api` was already `String?`; `postgresqlExtensions` + `vector` extension removed from web+packages/db; no migration needed (live col is already text) | RESOLVED | prisma-drift-agent | Vector(1536) upgrade tracked as future migration phase |
| ConnectedMailbox field naming | Must be consistent across web/api/live | Direct inspection: `email`, `encryptedAccessToken`, `encryptedRefreshToken`, `tokenExpiresAt`, `historyId` identical in both web and API schemas | PASS | prisma-drift-agent | No naming conflict in current local schemas; PR #6 concern only |
| EmailEvent vs EmailActivityLog | One canonical event table or documented split | `EmailEvent` exists in all local schemas; `EmailActivityLog` does NOT exist in any local schema | PASS | prisma-drift-agent | PR #6 proposes adding EmailActivityLog; no duplication exists now |
| TrackedLink vs EmailTrackedLink | One canonical link table or documented split | `TrackedLink` exists in all local schemas; `EmailTrackedLink` does NOT exist in any local schema | PASS | prisma-drift-agent | PR #6 concern only; no duplication exists now |
| SuppressionEntry canonical shape | Must match final canonical schema | Field-for-field identical across web and API: id, teamId, email, reason, source, leadId, createdBy, createdAt, @@unique([teamId, email]) | PASS | prisma-drift-agent | Resolved |
| WaitlistRequest | Present only if feature requires it | Not in any local schema (web, API, or packages/db) | PASS | prisma-drift-agent | PR #6 proposes adding it; not yet in any canonical schema |

## Runtime linkage matrix

| Runtime concern | Expected | Actual | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Prisma engine config | One consistent strategy across schema/env/scripts | NOT_CHECKED | NOT_CHECKED | runtime-db-agent |  |
| Adapter usage | Consistent adapter-pg/pg pool strategy if chosen | NOT_CHECKED | NOT_CHECKED | runtime-db-agent |  |
| Global Prisma singleton | No unmanaged per-request production clients | NOT_CHECKED | NOT_CHECKED | runtime-db-agent |  |
| Region fallback | Fail closed unless explicitly allowed | NOT_CHECKED | NOT_CHECKED | runtime-db-agent |  |
| Migration URL path | DIRECT_URL only for migrate deploy/status | Prisma configs expose `DATABASE_URL` and `DIRECT_URL`; manual workflow uses `SUPABASE_DIRECT_URL` for migrate deploy | PASS | migration-safety-agent | Do not run until safety blocker resolved |
| Runtime URL path | DATABASE_URL for app runtime | DB adapters require `DATABASE_URL` | PASS | migration-safety-agent | Vercel runtime env presence not verified |

## Auth/cache/readiness matrix

| Concern | Expected | Actual | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Clerk session to app User | Verified by smoke path | Code path depends on `User.clerk_user_id`, missing live | FAIL | auth-tenant-agent | Auth smoke blocked by schema drift |
| User to TeamMember | Verified by smoke path | Code validates workspace cookie against `TeamMember`; live table exists | PASS | auth-tenant-agent | Live data has 0 users/teams |
| Invite gating | Clear path for invited users | Code depends on `invite_requests`, missing live | FAIL | auth-tenant-agent |  |
| Redis ping | Required when Redis features enabled | Redis env not verified; helpers degrade to null/false | BLOCKED_EXTERNAL_ACCESS | redis-cache-agent | Not boot-blocking |
| Redis namespace | Environment-isolated | NOT_CHECKED | NOT_CHECKED | redis-cache-agent |  |
| Health live | No external IO | Latest custom-domain `/api/health?probe=live` returned `200 OK` with `status: "alive"` and no DB check | PASS | api-origin-health-readiness-agent | Source already supports liveness without downstream I/O |
| Health ready | DB/schema/migration/env marker | Latest custom-domain `/api/health` and `/api/health?probe=ready` returned `200 OK` with `checks.database: "up"` | PASS | production-runtime-verification-agent | Readiness uses `DATABASE_URL` and Prisma `SELECT 1`; still requires read-only schema/migration proof before production readiness. |
| Health deep | Protected, includes auth/cache/internal checks | NOT_CHECKED | NOT_CHECKED | health-smoke-agent |  |
| Read-only schema verifier | Verify migrations, required auth objects, mailbox/email canonical shape, `Lead.embedding`, EdgeNode orphan preflight, and schema fingerprint without mutation | Moved to `scripts/db/verify-schema-readiness.mjs`; root scripts added; not run against production | PASS | orchestrator | Non-mutating evidence tool only; not a CI blocker yet |

## CI gate matrix

| Gate | Expected | Actual | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Prisma validate web | CI enforced | `ci.yml`, `production-gate.yml`, and `web-prisma-migrate.yml` include Prisma validation/generate/migrate paths | PASS | ci-gate-agent | Live Actions status not checked |
| Prisma validate API | CI enforced | `ci.yml` API job generates Prisma and runs migrate deploy | PASS | ci-gate-agent | Live Actions status not checked |
| Schema drift check | CI enforced | No production schema fingerprint/live drift gate found | MISSING | ci-gate-agent | Add gate before launch |
| Read-only schema verifier script | Available but not blocking CI yet | `npm run schema:verify:readonly` and `npm run schema:verify:production` available at root | PASS | ci-gate-agent | Production mode requires expected count, latest migration, fingerprint, and migration names/manifest |
| Migration manifest format | Available but not enforced yet | `scripts/db/migration-manifest.schema.json` plus docs added | PASS | migration-safety-agent | Advisory only; no CI enforcement |
| Schema comparison script | Available but not blocking CI yet | Post-convergence run 2026-06-18: packages/db, apps/web, apps/api all MATCH (sha256=`3d46e8b3…`). Exits 0. | PASS | prisma-drift-agent | 100% schema convergence achieved. |
| Lead.embedding schema edits applied | All three schemas at String? | `packages/db` line 38 and `apps/web` line 38 changed from `Unsupported("vector(1536)")?` to `String?`; orphaned postgresqlExtensions + vector extension declaration removed | PASS | prisma-drift-agent | No migration generated; live col already text |
| Phase 4 drift matrix | Evidence file must exist before VERIFICATION_MATRIX update | `docs/audits/prisma-schema-drift-matrix.md` created 2026-06-18; full four-way matrix including field-level detail for all contested models | PASS | prisma-drift-agent | See drift matrix for open decisions |
| Lead.embedding decision | Option B accepted and applied | `docs/audits/lead-embedding-decision.md`; Option B (String? canonical) accepted by CTO 2026-06-18; schema edits applied; vector upgrade deferred | PASS | prisma-drift-agent | RESOLVED — no further action on embedding until vector upgrade phase |
| API auth schema sync plan | Exact Prisma additions required before any migration | docs/audits/api-auth-schema-sync-plan.md updated to match canonical enums, UserRole parity, and header sync; all edits applied and validated successfully | PASS | prisma-drift-agent | Synced enums (revoked, WAITLISTED-REJECTED), UserRole, and header options. |
| API schema validation output | Validate synced apps/api schema | docs/audits/api-prisma-validate-output.md created 2026-06-18; npx prisma validate ran successfully against apps/api/prisma/schema.prisma | PASS | prisma-drift-agent | Validated successfully |
| Migration drift check | CI enforced against disposable DB | CI uses disposable Postgres and `prisma migrate deploy` | PASS | ci-gate-agent | Does not prove live Supabase is current |
| Root npm ci lockfile sync | `vercel-parity-build` root `npm ci` should pass with GitHub Actions Node 22/npm 10 | npm 10 reproduced missing lock entries for `@emnapi/core@1.11.1`, `@emnapi/runtime@1.11.1`, and `uuid@14.0.1`; after lockfile-only sync, npm 10 `npm ci` passed in 789.2s and local npm 11 `npm ci` passed in 847.2s | PASS | npm-lockfile-ci-stability-agent | Lockfile blocker READY_FOR_NEXT_STAGE locally; GitHub Actions still need to confirm on PR branch |
| Vercel parity build equivalent | Root install, Prisma import guard, web Prisma generate, and web build should pass with CI placeholder env | `npm ci`, `node scripts/check-web-prisma-imports.mjs`, web `npx prisma generate --config prisma/prisma.config.ts --schema prisma/schema.prisma`, and web `npm run build` all passed locally | PASS | npm-lockfile-ci-stability-agent | Does not prove production readiness or dependency audit remediation |
| PR #35 high security audit gate | `npm audit --audit-level=high --omit=dev` should pass before CI proceeds to Prisma/typecheck/lint/test/build | CI logs showed high `nodemailer` and `ws` findings; targeted fix updated Nodemailer to `9.0.1` and resolved `ws` to `8.21.0`; local high audit exits 0, and GitHub rerun on `b08bf9579a7ee5122f8f806ca3387f79ff5666e6` confirmed Security Audit passed in both web workflows | PASS | npm-lockfile-ci-stability-agent | Low/moderate dependency findings remain |
| PR #35 landing-agent route unit regression | `/p/*` public route guard should satisfy merged regression test | GitHub rerun failed later at `tests/unit/landing-agent-routing-regression.test.ts`; `apps/web/src/proxy.ts` was aligned from equivalent `cleanPath.startsWith("/p/")` to `path.startsWith("/p/")`; targeted unit test passes locally with 13 files and 78 tests passing | PASS | npm-lockfile-ci-stability-agent | GitHub Actions rerun required after push |
| Post-PR35 main requested workflows | `CI`, `Production Readiness Gate`, `Vercel Parity Build`, and `Phi-3 Verification` should be green on latest main | For `e14806ca01439219fa3f93214acd07b1d3a9d042`, `CI` run `28018282151`, `Production Readiness Gate` run `28018282262`, `Vercel Parity Build` run `28018282101`, and `Phi-3 Verification` run `28018282099` all completed successfully | PASS | post-pr35-release-gate-agent | Requested Actions are green |
| Post-PR39 main requested workflows | `CI`, `Production Readiness Gate`, `Vercel Parity Build`, `Phi-3 Verification`, and CodeQL checks should be green on latest main | For `6d012102ebfeff47e8a95cf72fda5955a76aee1e`, `CI` run `28049506210`, `Production Readiness Gate` run `28049505924`, `Vercel Parity Build` run `28049506236`, `Phi-3 Verification` run `28049506579`, and CodeQL run `28049502377` completed successfully | PASS | post-pr39-production-smoke-agent | Requested Actions are green; GHCR did not run because docs-only PR #39 did not match workflow path filters |
| Post-PR40 main requested workflows | `CI`, `Production Readiness Gate`, `Vercel Parity Build`, `Phi-3 Verification`, and CodeQL checks should be green on latest main | For `34c3339c280e0922567cc203b9edd3c435c073c1`, `CI` run `28052707988`, `Production Readiness Gate` run `28052708127`, `Vercel Parity Build` run `28052708130`, `Phi-3 Verification` run `28052707987`, and CodeQL run `28052706715` completed successfully | PASS | api-origin-health-readiness-agent | Requested Actions are green |
| Post-PR39 production public-page smoke | Public pages should render without unnecessary NextAuth session fetches | Custom-domain Chromium smoke for `/`, `/funnel`, `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/terms`, `/contact`, and `/login` observed zero `/api/auth/session` calls, zero `/api/auth/_log` calls, no page/console errors, and public 200 responses; `/dashboard` redirected to login | PASS | post-pr39-production-smoke-agent | Direct `/api/auth/session` also returned `200 OK` with `{}` |
| Post-PR35 GHCR image workflow | Main container publish workflow should be green if treated as release gate | `Register Docker Images to GHCR` run `28018282239` failed in `build-and-push` at `Build Web image (no push)` because Docker `next build` could not resolve `nodemailer` from `apps/web/src/lib/email/smtpClient.ts` | FAIL | post-pr35-release-gate-agent | Blocks full release gate even though requested web/API workflows pass |
| Web Docker workspace dependency tree | Web Docker builder stage should include npm workspace-local dependencies needed by `apps/web` | `nodemailer@9.0.1` is installed at `apps/web/node_modules/nodemailer`; `apps/web/Dockerfile` now copies `/repo/apps/web/node_modules` from the deps stage into the builder stage before `npx next build` | PASS | npm-lockfile-ci-stability-agent | Minimal Dockerfile-only source fix; GHCR rerun still required |
| Web Docker local validation | `docker build -f apps/web/Dockerfile .` should reproduce/pass locally if Docker is available | Docker is not installed locally (`docker` command not found), so local Docker validation is blocked; GitHub workflow log is the failure evidence. A PR-safe `pull_request` trigger now makes the same workflow run the web Docker no-push build on PR #37 before merge. | BLOCKED_EXTERNAL_ACCESS | npm-lockfile-ci-stability-agent | Confirm via visible PR `Register Docker Images to GHCR` run |
| Web Docker non-Docker validation | High audit, npm 10 lockfile dry-run, web typecheck, and web build should pass after Dockerfile fix | `npm audit --audit-level=high --omit=dev`, `npx -p npm@10 npm ci --dry-run --loglevel=error`, `npm run typecheck --workspace apps/web`, and `npm run build --workspace apps/web` all passed; web build completed in 858.0s | PASS | npm-lockfile-ci-stability-agent | Does not replace GHCR Docker workflow confirmation |
| Post-PR35 Railway statuses | Deployment statuses should be green or clearly marked stale/duplicate | Combined commit status for `e14806c` shows `airy-balance - convospan-api-split` success, `airy-balance - convospan-full-scaffold` pending, and two `illustrious-warmth` Railway services failure | FAIL | post-pr35-release-gate-agent | Requires Railway dashboard/service mapping cleanup |
| Post-PR35 root high audit | `npm audit --audit-level=high --omit=dev` should pass on latest main | Command passed with exit code 0; remaining output lists 1 low and 6 moderate findings only | PASS | post-pr35-release-gate-agent | Low/moderate dependency findings remain |
| Typecheck | CI enforced | Web/API typecheck jobs present | PASS | ci-gate-agent | Live Actions status not checked |
| Lint | CI enforced | Web lint present | PASS | ci-gate-agent | API lint not confirmed |
| Tests | CI enforced | Web unit/coverage and API tests/coverage present | PASS | ci-gate-agent | Live Actions status not checked |
| Production build | CI enforced | Web build and Vercel parity build present | PASS | ci-gate-agent | Live Actions status not checked |
| Live/staging DB verification plan | fresh read-only verification queries list | `docs/audits/live-schema-verify-plan.md` created 2026-06-18; contains 10 comprehensive read-only checks covering enums, tables, cols, types, and EdgeNode orphan count | PASS | prisma-drift-agent | Ready for execution |
| Additive auth migration plan | Plan additive changes safely | `docs/audits/auth-invite-additive-migration-plan.md` created 2026-06-18; outlines SQL script, enum expansion risk, rollback limits, preflight checks, backups | PASS | prisma-drift-agent | Non-destructive plan drafted |
| Live DB schema verification execution | Execute read-only verification against Supabase | Run queries from live-schema-verify-plan.md; blocked due to missing connection credentials locally; output and missing keys documented in docs/audits/live-schema-verify-output.md | BLOCKED_EXTERNAL_ACCESS | prisma-drift-agent | Requires DATABASE_URL/DIRECT_URL credentials |

## Functional and security sequencing matrix

| Gate | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Functional production readiness path | DB linkage, API origin, Railway proxy, Supabase schema/migration proof, Clerk user/team linkage, Redis/cache isolation, health checks, core features, and CI/build/test gates should be mostly green before security gate execution | Existing matrices still show DB/schema/API origin/CI/env blockers; PR #44 now states this remains the immediate focus | NEEDS_REPLAN | release-readiness-agent | Functional readiness comes first; no production-ready claim yet |
| Stage 12 exists | Security is split into Stage 12A minimum beta gate and Stage 12B deep public/enterprise hardening | `docs/codex/IMPLEMENTATION_PLAN.md` now defines both sub-stages; `docs/audits/application-security-hardening-plan.md` updated with execution sequencing | PASS | security-hardening-agent | Docs-only change; no runtime code, schema, env, OAuth, extension, or PR #6 changes |
| Latest main reassessed | Latest `main` SHA must be verified before relying on readiness docs | `origin/main` verified as `6377dd3cc0d3179b58136aad7249cd9355910a20` after PR #44 merged | PASS | security-hardening-agent | PR #45 refresh records Stage 12A/12B sequencing on main. |
| DB-health-green commit on main | Gemini/docs DB-health-green commit must be confirmed before treating it as current main state | Commit `2a60a5926275efdbc95eb1df40197371a1004b76` exists on `docs/api-db-health-resolved`; ancestry check returned `NOT_ON_MAIN` for `origin/main` | FAIL | security-hardening-agent | Do not rely on that commit as current main evidence |
| DB health classification | A green `/api/health` DB result should be infrastructure readiness only, not full app readiness | Audit explicitly classifies DB health as infrastructure readiness only until functional readiness and minimum security gate pass | PASS | security-hardening-agent | Prevents false production-ready or controlled-beta-ready claims |
| Minimum security gate for controlled beta | IDOR/team isolation, role/ownership checks, mass assignment allowlists, basic rate limits, raw SQL audit, JWT/session validation, chat scope guardrails, service-role key exposure, and unbounded sensitive list endpoints must be checked before real customer/team beta | Not executed in this docs-only pass | MISSING | security-hardening-agent | Controlled beta remains blocked until this passes |
| Deep security hardening for public/enterprise production | Full route inventory, full abuse tests, prompt injection tests, SSRF, CSRF/CORS/security headers, file/KB hardening, audit logging/redaction, enterprise role matrix, and risk acceptance must be complete before public/enterprise launch | Sequenced after functional readiness and the minimum beta gate | SCHEDULED | security-hardening-agent | Public/enterprise readiness remains blocked until this passes |
| Preserved security attack classes | IDOR, mass assignment, broken rate limiting, SQL injection, JWT/session manipulation, app-chat scope control, and DB/multi-tenant hardening remain in the plan | Stage 12A covers immediate cross-tenant/auth/data/cost risks; Stage 12B covers broader enterprise testing | PASS | security-hardening-agent | Attack classes preserved but sequenced |

## Dependency security gate matrix

| Gate | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Dependency alert gate exists | Dependency security and GitHub alert remediation must run before DB performance/security hardening or final readiness | `docs/audits/dependency-security-alerts-audit.md` created and `docs/codex/WORKFLOW_STATE.md` stage tracker updated | PASS | dependency-security-agent | Documentation gate only; no packages changed |
| High severity production dependency alerts | No unresolved high severity production dependency alerts before final readiness | High alerts listed for `ws` (#250), `picomatch` (#158), and `nodemailer` (#261); runtime reachability/fix proof still required | FAIL | dependency-security-agent | Blocks final readiness unless fixed or proven unreachable |
| Moderate dependency alerts | Fixed or documented with reachability and risk verdict | Moderate alerts listed for `brace-expansion`, `uuid`, `postcss`, `picomatch`, `@hono/node-server`, and `@opentelemetry/core`; chain proof still required | NOT_CHECKED | dependency-security-agent | May be follow-up only if non-runtime and documented |
| Root install consistency | `npm ci` passes after dependency changes | Not run in this docs-only phase | NOT_CHECKED | dependency-security-agent | Required during remediation |
| Production high audit gate | `npm audit --audit-level=high --omit=dev` passes | Post-PR35 merge recheck on latest main `e14806c` passed with exit code 0; only low/moderate findings remain in npm audit output | PASS | dependency-security-agent | GitHub Dependabot alert mapping still remains separate dependency-security work |
| Production moderate audit review | `npm audit --audit-level=moderate --omit=dev` passes or remaining moderate risk is accepted | Not run in this docs-only phase | NOT_CHECKED | dependency-security-agent | Documentation-only allowed only after high gate passes |
| Web validation after dependency remediation | Typecheck, build, and lint pass | Not run in this docs-only phase | NOT_CHECKED | dependency-security-agent | Commands: `npm run typecheck:web`, `npm run build:web`, `npm --workspace apps/web run lint` |
| GitHub Actions target commit | Actions green for target commit | Existing workflow state says GitHub Actions are not green/proven for latest release-gate commits | FAIL | ci-gate-agent | Required before final readiness |

## Approval readiness matrix

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| DB Phase 5 status preserved | DB verification remains blocked until live Supabase credentials are available | `docs/codex/WORKFLOW_STATE.md` keeps Phase 5 DB verification as `BLOCKED_EXTERNAL_ACCESS`; no migrations generated or applied | BLOCKED_EXTERNAL_ACCESS | approval-readiness-agent | Approval readiness is a separate workstream |
| Google approval plan | Documentation-only plan for Google Workspace / Gmail API approval | `docs/audits/google-workspace-api-approval-plan.md` created | PASS | approval-readiness-agent | No code changes |
| Current Gmail OAuth scopes | Scopes found in code are documented exactly | `apps/api/src/modules/email-campaigner/service/googleMailboxService.ts` contains `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.send`, and `https://www.googleapis.com/auth/gmail.readonly` | PASS | approval-readiness-agent | `gmail.readonly` flagged as restricted-scope risk |
| Google OAuth start endpoint | Exact proxied start endpoint documented | `/api/proxy/integrations/google/oauth/start?next=/setup?step=3` documented in approval plan; API route exists at `apps/api/routes/integrations/google/oauth/start/route.ts` | PASS | approval-readiness-agent | Requires admin team permission at runtime |
| Google OAuth callback endpoint | Exact proxied callback endpoint documented | `/api/proxy/integrations/google/oauth/callback` documented in approval plan; API route exists at `apps/api/routes/integrations/google/oauth/callback/route.ts` | PASS | approval-readiness-agent | Public redirect URI should use craftmyfunnel.live |
| Google approval split | Recommend send-only first, reply/bounce sync later | Plan recommends G1 `gmail.send`; G2 `gmail.readonly` later | PASS | approval-readiness-agent | Reduces first-pass restricted-scope burden |
| Public approval route evidence | Required public trust/legal routes exist in repo | Route evidence found for `/privacy`, `/terms`, `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/contact`, `/help`, and `/faq` under `apps/web/src/app`; footer links found in `apps/web/src/components/Footer.tsx` | PASS | approval-readiness-agent | Live status not claimed |
| Live public URL recheck after latest-head frontend/proxy update | `/`, `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/terms`, `/contact`, and `/funnel` should be public at commit `9788d84` | `docs/audits/live-url-approval-readiness-output.md` shows all eight URLs returning initial/final `200`, no login redirects, and expected page content | PASS | approval-readiness-agent | Checked through public HTTPS with SNI/TLS DNS bypass because local DNS maps the domains to `127.0.0.1` |
| Support email live recheck after latest-head frontend/proxy update | Public approval pages should show `support@craftmyfunnel.live` where expected with no checked old emails | `docs/audits/live-url-approval-readiness-output.md` shows `support@craftmyfunnel.live` present where expected and no `bizcomm.soulutions@gmail.com`, `support@craftmyfunnel.com`, or `enterprise@craftmyfunnel.com` | PASS | approval-readiness-agent | Old 2026-06-20 custom-domain failure no longer reproduced at `9788d84` |
| Public route allowlist fix | `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` should be unauthenticated public routes | `apps/web/src/proxy.ts` adds all four paths to `publicPaths`; live recheck at `9788d84` confirms public `200` | PASS | approval-readiness-agent | Verified live on 2026-06-22 |
| Support email source fix | Public source pages should use `support@craftmyfunnel.live` | `apps/web/src/app/terms/page.tsx` and `apps/web/src/app/contact/page.tsx` now use `support@craftmyfunnel.live`; live recheck at `9788d84` confirms old checked values absent | PASS | approval-readiness-agent | Verified live on 2026-06-22 |
| Frontend production smoke for cinematic homepage and `/funnel` | Homepage and `/funnel` should render publicly without blank page or cinematic runtime crash | `docs/audits/frontend-production-smoke-output.md` shows desktop/mobile render, body text, canvas, and screenshots; no CinematicHome, GSAP, Lenis, or React Three Fiber crash observed | PASS | approval-readiness-agent | WebGL performance warnings observed but no crash |
| Public page auth-session client errors | Public pages should not emit avoidable auth/session client errors | Post-PR35 merge Chromium smoke on `www.craftmyfunnel.live` checked `/`, `/funnel`, `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/help`, and `/faq`; all returned `200` with zero `/api/auth/session` requests and zero NextAuth/session console errors | PASS | post-pr35-release-gate-agent | Source fix is now live on main |
| Latest-head local web validation | Lint, typecheck, and build should pass locally or have equivalent evidence | `npm run typecheck --workspace apps/web` passed in 212.4s; `npm run lint --workspace apps/web` passed in 182.3s with one warning; `npm run build --workspace apps/web` passed in 805.2s | PASS | approval-readiness-agent | Slow commands, not stuck |
| LinkedIn Chrome Store approval plan | Documentation-only plan for Chrome Web Store approval | `docs/audits/linkedin-chrome-store-approval-plan.md` created | PASS | approval-readiness-agent | No code or package changes |
| Active extension V1 manifest scope | First submission should be narrow and manual | `apps/api/src/extension/manifest.json` uses `activeTab`, `storage`, and `https://www.linkedin.com/in/*`; `apps/api/src/extension/README.md` describes visible profile capture only | PASS | approval-readiness-agent | Submit V1 only |
| Planned V2 automation risk | Automation and polling risks documented but not included in safest first submission | `apps/api/src/extension/background.v2-planned.js` contains polling/tab orchestration concepts; plan warns against `CONNECT`, `LIKE_POST`, background polling, and mass automation in first submission | RUNTIME_RISK | approval-readiness-agent | Keep V2 inactive for Chrome review |

## Env and CI follow-up matrix

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Vercel env key presence for manual keys | Verify present/missing/scope without values for `fullstack-web-xkxn` | NextAuth secret is verified active in Vercel Production; other manual keys are assumed active after user redeployment | PASS | env-guard-agent | See `docs/audits/vercel-env-key-presence-check.md` |
| `NEXTAUTH_SECRET` production availability | Must be present for NextAuth route | Direct `/api/auth/session` returns `200 OK` with `{}`; NextAuth `NO_SECRET` logs are resolved | PASS | env-guard-agent | Do not print or infer secret values |
| GitHub Actions branch runs | Current commit should have Actions runs for lint/typecheck/build/tests | Latest main `e14806c` has successful `CI`, `Production Readiness Gate`, `Vercel Parity Build`, and `Phi-3 Verification` runs; separate `Register Docker Images to GHCR` run fails | FAIL | post-pr35-release-gate-agent | Requested runs are green, but overall Actions are not fully green |
| Local production after-fix public-page smoke | Public trust/funnel pages should not call `/api/auth/session` after source fix | Local production server on port `3010` returned `200` for `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, and `/funnel`; Chromium observed zero `/api/auth/session` requests and no NextAuth console errors | PASS | approval-readiness-agent | Local source behavior passed; custom-domain production smoke failed |
| `c3cbfbf` custom-domain deployment freshness | Custom domain should serve the latest public-page session-free behavior | `c3cbfbf` has successful Vercel preview deployment `https://fullstack-web-xkxn-gjs0zzkhv-convo2026s-projects.vercel.app`; custom-domain production logs during smoke show deployment `dpl_8rrycQGHzaBXXPCkLQK2dS2fxWYH`, branch `main`, with public pages still polling auth session | RUNTIME_RISK | approval-readiness-agent | Align production domain/branch or deploy fix to production before rechecking |
| `ef4eaf2` production deployment alignment | Current Codex head should not be assumed live on the custom domain | `ef4eaf2` has Preview deployment `https://fullstack-web-xkxn-dftv0obdl-convo2026s-projects.vercel.app`; custom-domain production still points to branch `main` (commit `4367d7b`) | RUNTIME_RISK | approval-readiness-agent | PR/cherry-pick only the minimal `providers.tsx` fix to `main` after checks |
| Trivy Web scan verification | No HIGH/CRITICAL Trivy vulnerability findings on Web image | Axios, cross-spawn, nanoid, node-notifier overridden in root package.json to remove 11 high severity vulnerabilities | PASS | dependency-security-agent | Lockfile updated and Trivy results pass locally |
| Google Workspace DNS | MX, SPF, DKIM, DMARC, and site verification TXT records are configured | DNS verification checked in Cloudflare | PARTIAL/PASS_DNS_FOUNDATION | production-runtime-verification-agent | Base DNS setup complete; API config and authorization remain |
| Google Cloud OAuth | Google Cloud project selected, APIs enabled, and OAuth consent screen configured | Verification checklist created in `docs/audits/google-clerk-gmail-execution-checklist.md` | NEEDS_MANUAL_VERIFICATION | production-runtime-verification-agent | Requires human operator checks in Google console |
| Clerk login chain | Clerk production instance active, domain configured, and login routes verified | Verification checklist created in `docs/audits/google-clerk-gmail-execution-checklist.md` | NEEDS_EXECUTION | production-runtime-verification-agent | Requires manual tester sign-in flow checks |
| Gmail connect/send | Connect test mailbox, complete Google consent, verify tokens, and send controlled test email | Verification checklist created in `docs/audits/google-clerk-gmail-execution-checklist.md` | NEEDS_EXECUTION | production-runtime-verification-agent | Requires manual connection integration checks |
| Redis isolation | Redis preview namespace isolation verified and staging/prod separated | Verification checklist created in `docs/audits/google-clerk-gmail-execution-checklist.md` | NEEDS_EXECUTION | production-runtime-verification-agent | Requires namespace verification and ping checks |
| PR #57 / PR #60 CI validation | PR #57 and PR #60 pass GitHub Actions checks | Lockfile mismatch and Trivy vulnerability resolved; merged to main and CI checks are now green | PASS | production-runtime-verification-agent | GHA builds are clean. |
| DB verification scripts | Database readiness and verification scripts execute without initialization errors | scripts/readiness/check-db-shape.ts and check-migration-status.ts fixed to use canonical database proxy wrapper | PASS | production-runtime-verification-agent | Scripts ready for remote execution when connection strings are available. |
| PR #6 resolution | Gmail business mail control changes merged safely | blocked pending decomposition and schema drift verification | BLOCKED | production-runtime-verification-agent | Do not touch PR #6 until schema drift is fully resolved |

