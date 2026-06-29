# Codex Workflow State

This file is the source of truth for current task status. Update it after every agent stage.

## Current status

| Field | Value |
| --- | --- |
| Overall status | NEEDS_REPLAN |
| Current stage | Trivy Web scan failure remediation |
| Current agent | production-runtime-verification-agent |
| Working branch | fix/trivy-web-scan-failure |
| Baseline commit inspected | d53520bba68e1f5ea95d420237d667cc8a1891b4 |
| API Internal Origin | Public Railway HTTPS origin confirmed: `https://convospan-api-split-production.up.railway.app`; env value not printed |
| Railway API health | PASS — `/health` returns 200, database up |
| Vercel web health | PASS — `/api/health` returns 200, database up |
| Vercel readiness probe | PASS — `/api/health?probe=ready` returns 200, 17ms |
| Vercel proxy unauthenticated | EXPECTED_AUTH_GATE — `/api/proxy/health` returns 401 |
| Overall product readiness | NOT_READY |
| Last updated | 2026-06-29T16:40+05:30 |
| Next action | Verify Trivy Web scan fix in GitHub actions run |

## Status values

Use only these values:

- NOT_STARTED
- IN_PROGRESS
- READY_FOR_NEXT_STAGE
- NEEDS_INPUT
- NEEDS_REPLAN
- BLOCKED
- BLOCKED_EXTERNAL_ACCESS
- BLOCKED_BY_SCHEMA_CONFLICT
- BLOCKED_BY_FAILED_TESTS
- CONTROLLED_BETA_READY
- PRODUCTION_READY

## Active blockers

| Blocker | Owner agent | Evidence | Next action | Status |
| --- | --- | --- | --- | --- |
| Live DB behind local Prisma migrations | prisma-drift-agent | Supabase `_prisma_migrations` has 17 rows; local web has 25 migration dirs; local API has 22 migration dirs | Choose canonical Prisma source and migration plan | BLOCKED_BY_SCHEMA_CONFLICT |
| Live DB missing Clerk/invite schema used by web auth | auth-tenant-agent | Live DB lacks `User.clerk_user_id`, `UserInvitation`, and `invite_requests`; `apps/web/src/lib/clerkAuth.ts` depends on those objects | Apply reviewed non-destructive migrations or deploy code matching live schema | BLOCKED_BY_SCHEMA_CONFLICT |
| Pending migration contains destructive delete | migration-safety-agent | `20260604140000_edge_runtime_pairing` contains `DELETE FROM "EdgeNode"` | Split into audited preflight/backup/review before production migration | BLOCKED |
| API_INTERNAL_ORIGIN authenticated proxy forwarding verified | production-runtime-verification-agent | Authenticated proxy-to-Railway forwarding verified via browser, Vercel, and Railway logs under active session. | Proceed to Clerk user/team linkage and Redis isolation verification | READY_FOR_NEXT_STAGE |
| Production web readiness reports database down | release-readiness-agent | Latest custom-domain `/api/health` and `/api/health?probe=ready` return `503` with `checks.database: "down"`; `/api/health?probe=live` returns `200`, so process liveness is healthy and DB readiness is failing. | Verify Vercel Production `DATABASE_URL` presence/target/connectivity and redacted runtime error without changing DB data | NEEDS_INPUT |
| Main release gate not fully green | ci-gate-agent | Latest main `34c3339` has Vercel, active `airy-balance` Railway statuses, and GitHub Actions green. Stale `illustrious-warmth` contexts still appear as no-op success statuses; required-check list is still a manual GitHub admin confirmation. | Confirm stale Railway contexts are not required branch-protection checks and decide whether GHCR is optional image-publishing evidence or a required release gate | NEEDS_REPLAN |
| Dependency security alerts unresolved | dependency-security-agent | GitHub Dependabot alerts include high severity `ws`, `picomatch`, and `nodemailer` findings plus moderate `brace-expansion`, `uuid`, `postcss`, `picomatch`, `@hono/node-server`, and `@opentelemetry/core` findings | Run dependency alert mapping/remediation; fix high production alerts without `npm audit fix --force`; document moderate reachability/risk | NEEDS_REPLAN |
| Minimum security gate not yet executed | security-hardening-agent | `docs/audits/application-security-hardening-plan.md` now defines Stage 12A minimum beta gate; no route inventory or fixes have been executed in this docs-only pass | Run Stage 12A after functional readiness is mostly green and before controlled beta; do not treat DB health as full app readiness | NEEDS_REPLAN |
| Deep security hardening not yet executed | security-hardening-agent | `docs/audits/application-security-hardening-plan.md` now defines Stage 12B deep public/enterprise hardening | Run Stage 12B before public launch, enterprise launch, or scale marketing | NEEDS_REPLAN |
| PR #6 must not merge as-is | pr-strategy-agent | PR #6 is broad, mergeable=false, and overlaps schema/env/docs/runtime concerns | Split PR #6 into reviewable slices | BLOCKED_BY_SCHEMA_CONFLICT |

## Stage tracker

| Stage | Agent | Status | Evidence file | Notes |
| --- | --- | --- | --- | --- |
| 0. Branch and baseline | orchestrator | READY_FOR_NEXT_STAGE | WORKFLOW_STATE.md | Branch `codex/db-linkage-swarm-orchestration`, baseline `12174245a1af55d32c0b46a04b5d9f7b0a2948cd` |
| 1. Repo cartography | repo-cartographer | READY_FOR_NEXT_STAGE | WORKFLOW_STATE.md | Apps: web/API/edge-fastapi; web/API Prisma schemas; CI workflows mapped |
| 2. Vercel linkage inspection | vercel-linkage-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | Project/deployment found; env mapping not verified |
| 3. Supabase live schema inspection | supabase-inspector | NEEDS_REPLAN | VERIFICATION_MATRIX.md | Active project found; live schema drift found |
| 4. Prisma ownership and drift | prisma-drift-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | web/API schemas validate but histories diverge |
| 5. Gmail/mailbox conflict resolution | prisma-drift-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | PR #6 conflicts with canonical schema strategy |
| 6. Migration safety | migration-safety-agent | BLOCKED | VERIFICATION_MATRIX.md | Destructive `DELETE FROM "EdgeNode"` found |
| 7. Runtime DB alignment | runtime-db-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | App health checks still rely on `SELECT 1` |
| 8. Env linkage guards | env-guard-agent | BLOCKED_EXTERNAL_ACCESS | VERIFICATION_MATRIX.md | Vercel env-key/target proof unavailable |
| 9. Health and smoke tests | health-smoke-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | Vercel logs show `/` and `/login` 200; readiness endpoint not proven |
| 10. Clerk/app DB linkage | auth-tenant-agent | BLOCKED_BY_SCHEMA_CONFLICT | production-readiness-final.md | Clerk sync depends on missing live DB objects |
| 11. Redis/cache/queue isolation | redis-cache-agent | READY_FOR_NEXT_STAGE | production-readiness-final.md | Redis degrades gracefully; production Redis env still unverified |
| 12A. Minimum security gate for controlled beta | security-hardening-agent | NEEDS_REPLAN | docs/audits/application-security-hardening-plan.md | Runs after functional production readiness is mostly green and before real customer/team beta. Covers IDOR/team isolation, role/ownership checks, mass assignment, basic rate limits, raw SQL, JWT/session validation, chat scope, service-role key exposure, and unbounded sensitive lists. |
| 12B. Deep security hardening for public/enterprise production | security-hardening-agent | NEEDS_REPLAN | docs/audits/application-security-hardening-plan.md | Runs before public launch, enterprise launch, or scale marketing. Covers full route inventory, abuse tests, prompt injection, SSRF, CSRF/CORS/headers, file/KB hardening, audit logging/redaction, enterprise role matrix, and risk acceptance. |
| 13. CI and PR strategy | ci-gate-agent | NEEDS_REPLAN | production-readiness-final.md | CI structure exists; live Actions green not verified |
| 14. Final readiness | release-readiness-agent | NEEDS_REPLAN | production-readiness-final.md | Final status: not launch-ready; blocked until Stage 12 and dependency-security gates are satisfied |
| Implementation REPLAN d3086c0 | orchestrator | READY_FOR_NEXT_STAGE | IMPLEMENTATION_REPLAN_D3086C0.md | Produced canonical schema decision, unsafe migration quarantine, auth repair plan, and read-only schema verifier |
| Phase 1. Canonical schema architecture | orchestrator | READY_FOR_NEXT_STAGE | canonical-schema-architecture-plan.md | Moves target ownership toward `packages/db/prisma/schema.prisma`; `apps/web` remains temporary reference only |
| Phase 2. Migration safety gates | migration-safety-agent | READY_FOR_NEXT_STAGE | migration-manifest-format.md | Added advisory manifest format and root read-only verifier; unsafe EdgeNode migration not modified |
| Phase 3. Shared DB package skeleton | orchestrator | READY_FOR_NEXT_STAGE | packages/db/package.json | Added skeleton package, copied web schema as starting snapshot, added migration ownership README and schema compare gate script |
| Phase 4. Prisma drift resolution | prisma-drift-agent | READY_FOR_NEXT_STAGE | docs/audits/prisma-schema-drift-matrix.md, docs/audits/schema-compare-output.md, docs/audits/lead-embedding-decision.md, docs/audits/api-auth-schema-sync-plan.md, docs/audits/api-prisma-validate-output.md | Option B accepted (CTO). Lead.embedding=String? applied to packages/db, apps/web, and apps/api. API auth schema sync applied. All three schemas are in 100% character-for-character sync (MATCH) and validate successfully. Added API schema validate evidence. |
| Phase 5. DB verification & additive prep | prisma-drift-agent | BLOCKED_EXTERNAL_ACCESS | docs/audits/live-schema-verify-plan.md, docs/audits/auth-invite-additive-migration-plan.md, docs/audits/live-schema-verify-output.md | Created live schema verification plan and safety-reviewed additive SQL plan. Read-only live verification is blocked due to missing remote staging/production connection strings. |
| Approval readiness rebaseline 9788d84 | approval-readiness-agent | NEEDS_REPLAN | docs/audits/vercel-custom-domain-alias-check.md, docs/audits/live-url-approval-readiness-output.md, docs/audits/frontend-production-smoke-output.md | Vercel/GitHub status for `9788d84` is success. Custom domain now serves public approval URLs with expected content and no old email values. Follow-up auth/session investigation found `NEXTAUTH_SECRET` missing/unavailable in production and applied a source fix to stop checked public pages from polling `/api/auth/session`. Full local typecheck/lint/build now pass. No DB, schema, migration, production DB, unsafe EdgeNode migration, OAuth scope, Chrome permission, automation behavior, or PR #6 work performed. |
| Post-deploy auth/session smoke `c3cbfbf` | approval-readiness-agent | NEEDS_REPLAN | docs/audits/post-deploy-auth-session-smoke-c3cbfbf.md, docs/audits/frontend-auth-session-runtime-check.md, docs/audits/frontend-production-smoke-output.md, docs/audits/vercel-env-key-presence-check.md, docs/audits/github-actions-status-check.md | Vercel status for `c3cbfbf` is success and preview deployment exists, but the custom domain still requests `/api/auth/session` and `/api/auth/_log` on public pages. Fresh production logs identify custom-domain deployment as branch `main` and still show NextAuth `NO_SECRET`. No source changes made in this post-deploy smoke pass. |
| Production branch alignment `94a23d` | approval-readiness-agent | NEEDS_REPLAN | docs/audits/vercel-production-branch-alignment-check.md, docs/audits/github-actions-status-check.md, docs/audits/vercel-env-key-presence-check.md | Current Codex head `94a23d` has Vercel Preview success, but custom-domain production is branch `main`. Safe path is Production env repair plus PR/cherry-pick of only the minimal `providers.tsx` fix to `main` after checks. |
| Post-env-redeploy verification `ef4eaf2` | approval-readiness-agent | NEEDS_REPLAN | docs/audits/post-env-redeploy-auth-session-check.md, docs/audits/vercel-production-branch-alignment-check.md, docs/audits/vercel-env-key-presence-check.md, docs/audits/github-actions-status-check.md | Historical: Vercel Production redeploy resolved `/api/auth/session`; this earlier note said `API_INTERNAL_ORIGIN` was unset, now superseded by the 2026-06-26 runtime verification confirming the public Railway origin and leaving authenticated proxy proof pending. |
| Post-revert deployment triage `094663f` | deployment-triage-agent | NEEDS_REPLAN | docs/audits/post-revert-deployment-triage.md | PR #28 reverted Dependabot package bumps; PR #25 provider fix and PR #23 hero merge remain preserved. Vercel status is success, one Railway API service succeeds, three Railway statuses fail across duplicate projects/services, and several GitHub Actions web/Docker checks fail. No source/env/DB changes made. |
| Latest-main release gate recheck `a232648` | release-gate-recheck-agent | NEEDS_REPLAN | docs/audits/latest-main-release-gate-recheck.md | Vercel and all Railway contexts are green on latest main. GitHub Actions still fail for web build, vercel parity, and production stability audit. Local web/API typecheck/build pass; web audit gate fails locally with high vulnerabilities. `API_INTERNAL_ORIGIN` remains unproven. |
| Post-PR35 merge release gate `e14806c` | post-pr35-release-gate-agent | NEEDS_REPLAN | docs/audits/post-pr35-merge-release-gate.md | PR #35 is merged. Requested Actions and Vercel are green; public pages no longer fetch `/api/auth/session`; `/dashboard` redirects to login; high npm audit passes. Overall release remains blocked by GHCR Docker image failure, Railway failed/pending statuses, DB/schema drift, API_INTERNAL_ORIGIN, and dependency alert work. |
| Web Docker GHCR nodemailer hotfix | npm-lockfile-ci-stability-agent | NEEDS_REPLAN | docs/audits/web-docker-nodemailer-build-fix.md | Root cause: npm installs `nodemailer` under `apps/web/node_modules`, but `apps/web/Dockerfile` builder stage copied only root `node_modules`. Fix copies `/repo/apps/web/node_modules` from deps to builder. The GHCR workflow now includes a PR-safe `pull_request` verification path that builds the web image with `load: true` and skips GHCR login/push steps. |
| Stale Railway check cleanup and phased improvement plan | release-gate-cleanup-agent | NEEDS_REPLAN | docs/audits/stale-railway-check-removal.md, docs/plans/next-phased-production-improvements.md | Latest main `bbd3d47` still received stale `illustrious-warmth` statuses. Branch protection required checks could not be read with current tooling (`401 Unauthorized`), so manual GitHub UI cleanup steps are documented. |
| Post-PR39 production custom-domain smoke and API proxy readiness | post-pr39-production-smoke-agent | NEEDS_REPLAN | docs/audits/production-custom-domain-smoke-after-pr39.md, docs/audits/api-proxy-origin-readiness.md | Historical: latest main `6d01210` had public custom-domain smoke green but API origin and DB health blocked; superseded by the 2026-06-26 runtime verification showing the public Railway origin and web/API DB health green, with authenticated proxy proof still pending. |
| API origin and production health readiness diagnosis | api-origin-health-readiness-agent | NEEDS_INPUT | docs/audits/api-origin-production-health.md, docs/audits/production-health-db-down-root-cause.md | Latest main d3bcbb3 has GitHub Actions, Vercel, and active statuses green. Health liveness passes (200), readiness fails (503 DB down), proxy is auth-protected (401). |
| Post-PR44 functional readiness reassessment | functional-readiness-reassessment-agent | NEEDS_REPLAN | docs/audits/production-readiness-next-actions.md | Latest main is `6377dd3`; PR #44 is merged and Stage 12A/12B sequencing is on main; DB-health-green commit `2a60a59` is still off-main; main still documents DB readiness down; API origin, live schema proof, Clerk linkage, Redis isolation, deep health, and PR #6 remain blockers. |
| Production runtime verification — green health recorded | production-runtime-verification-agent | NEEDS_REPLAN | docs/audits/production-runtime-verification-after-api-origin.md | Latest main is `a827db4`; PR #44 and #45 are merged; Railway API origin PASS, Railway API DB health PASS, Vercel web DB health PASS, Vercel readiness probe PASS, Vercel proxy unauthenticated EXPECTED_AUTH_GATE; authenticated proxy forwarding, Clerk linkage, Redis isolation, and Supabase schema proof still need verification; product remains NOT_READY. |
| Authenticated proxy verification planning | production-runtime-verification-agent | READY_FOR_NEXT_STAGE | docs/audits/authenticated-proxy-verification-plan.md | Latest main is 33a0efa; PR #47 is merged; created authenticated proxy verification plan defining protocols, safe boundaries, and pass/fail criteria; overall product remains NOT_READY. |
| Authenticated proxy verification execution | production-runtime-verification-agent | READY_FOR_NEXT_STAGE | docs/audits/authenticated-proxy-verification.md | Verification executed successfully. Authenticated proxy forwarding verified on production host; Vercel-to-Railway forwarding proven for all core read-only routes. |
| Post-PR52 production regression audit | production-runtime-verification-agent | READY_FOR_NEXT_STAGE | docs/audits/post-pr52-production-regression-audit.md | Succeeded. All core health/readiness endpoints green. Dashboard pages, scheduler, and workers verified without regressions. |
| Supabase schema/migration proof planning | production-runtime-verification-agent | READY_FOR_NEXT_STAGE | docs/audits/supabase-schema-migration-proof-plan.md | Created docs-only plan for read-only schema status and drift verification commands. |
| Clerk user/team linkage verification planning | production-runtime-verification-agent | READY_FOR_NEXT_STAGE | docs/audits/clerk-user-team-linkage-verification-plan.md | Created docs-only plan for read-only browser credentials testing and database queries. |
| Supabase schema/migration proof execution scripts | production-runtime-verification-agent | READY_FOR_NEXT_STAGE | docs/audits/supabase-schema-migration-proof-results.md | Created safe read-only scripts for tables presence and column drift check. |
| Trivy Web scan failure remediation | production-runtime-verification-agent | READY_FOR_NEXT_STAGE | docs/audits/trivy-web-scan-remediation.md | Overrode axios, cross-spawn, nanoid, node-notifier to fix 11 high severity vulnerabilities. |

## Latest findings

- **2026-06-29T16:40+05:30 Trivy Web scan failure remediation pass** on latest main `d53520bba68e1f5ea95d420237d667cc8a1891b4` resolved the Web image Trivy vulnerability failures by adding package version overrides in root `package.json` and updating the lockfile.
- **2026-06-29T15:45+05:30 Supabase schema/migration proof execution scripts pass** on latest main `33b46cc598007ea45f1b51fc3a5a8a1ff14ebbc8` created the read-only db shape and migration check scripts and results template.
- **2026-06-29T14:45+05:30 Clerk user/team linkage verification planning pass** on latest main `06d1ee84551bec623f31b69933a4d6f2b8bfc4fa` created the linkage verification plan (`docs/audits/clerk-user-team-linkage-verification-plan.md`) defining manual browser credentials tests and diagnostic database queries.
- **2026-06-29T14:10+05:30 Supabase schema/migration proof planning pass** on latest main `04b64d1abe445fd0f83fa2d372e575d9bd1bb4ee` created the schema proof plan (`docs/audits/supabase-schema-migration-proof-plan.md`) outlining read-only status/drift check commands and criteria.
- **2026-06-29T12:58+05:30 post-merge regression audit** on latest main `806be69526d17db455a19b7626c06a7fad95f8dd` recorded execution evidence in `docs/audits/post-pr52-production-regression-audit.md`. Verified Vercel and Railway deployments are green. All core health endpoints return `200 OK` (database `up`). Browser pages campaigns, leads, workflows, layout, and components typecheck and function cleanly under auth session.
- **2026-06-27T17:20+05:30 verification execution pass** on latest main `428bae6fab693196b9e0a3d309446049607f8963` executed manual session testing protocol and recorded authenticated proxy verification proof in `docs/audits/authenticated-proxy-verification.md`. All core pages successfully routed GET requests through `/api/proxy` to Railway, returning 200 OK. Vercel and Railway logs verified matching path and timestamps.
- **2026-06-26T16:44+05:30 verification planning pass** on latest main `33a0efa507dce017a0e0d257d3e55195bcc7bae2` created the authenticated proxy verification plan (`docs/audits/authenticated-proxy-verification-plan.md`) to guide the manual session testing protocol for Vercel-to-Railway forwarding.
- **2026-06-26T15:48+05:30 verification pass** recorded green health for Railway API and Vercel web on latest main `a827db43697297ed19bc7308b71aefc8c34ab901`.
- Railway API: `GET https://convospan-api-split-production.up.railway.app/health` → 200, `status: "healthy"`, `service: "craftmyfunnel-api"`, `database: "up"`, `edge: "not_configured"`, `edgeRequired: false`.
- Vercel web: `GET https://craftmyfunnel.live/api/health` → 200, `status: "healthy"`, `service: "craftmyfunnel-web"`, `database: "up"`, `durationMs: 602`.
- Vercel readiness: `GET https://craftmyfunnel.live/api/health?probe=ready` → 200, `status: "healthy"`, `database: "up"`, `durationMs: 17`.
- Vercel proxy: `GET https://craftmyfunnel.live/api/proxy/health` → 401, `{"error":"Unauthorized"}`. This is an expected auth gate; the proxy route is auth-protected by middleware design.
- Readiness verdicts: Railway API origin PASS, Railway API DB health PASS, Vercel web DB health PASS, Vercel readiness probe PASS, Vercel proxy unauthenticated EXPECTED_AUTH_GATE. Overall product readiness: NOT_READY.
- Remaining blockers: Clerk user/team linkage, Redis/cache isolation, Supabase schema/migration proof, Prisma/live DB drift, protected/deep health, feature completeness smoke, PR #6, Stage 12A, Stage 12B.
- Post-PR44 refresh on 2026-06-26 inspected latest `origin/main` at `6377dd3cc0d3179b58136aad7249cd9355910a20`.
- PR #44 is merged: `gh pr view 44` reports `state: MERGED`, `mergedAt: 2026-06-26T07:53:59Z`, and merge commit `6377dd3cc0d3179b58136aad7249cd9355910a20`.
- Stage 12A minimum security gate and Stage 12B deep security hardening sequencing is now present on `main`.
- The DB-health-green docs commit `2a60a5926275efdbc95eb1df40197371a1004b76` exists on `docs/api-db-health-resolved` / `origin/docs/api-db-health-resolved` but is not on `origin/main`; `git merge-base --is-ancestor 2a60a59 origin/main` returned `NOT_ON_MAIN`.
- Main currently documents production `/api/health` and `/api/health?probe=ready` as `503` with `checks.database: "down"`; the 200/up documentation exists only on the off-main DB-health branch.
- If a future Vercel production `/api/health` result returns `200`, treat it as infrastructure readiness only; controlled beta still requires Stage 12A minimum security gate, and public/enterprise readiness still requires Stage 12B deep hardening.
- Current immediate focus remains functional production readiness: DB linkage, API origin, Railway proxy, Supabase schema/migration proof, Clerk user/team linkage, Redis/cache isolation, health checks, feature completeness, and CI/build/test gates.
- Overall readiness remains `NEEDS_REPLAN`. Controlled beta remains blocked until Stage 12A minimum security gate is complete; public/enterprise readiness remains blocked until Stage 12B deep hardening is complete.
- Functional readiness remains blocked by DB readiness proof beyond `SELECT 1`, read-only Supabase schema/migration proof, API origin, Clerk user/team linkage, Redis/cache isolation, protected/deep health, CI/live schema policy, feature smoke, and PR #6.
- API origin and health diagnosis on latest main `d3bcbb3a12d7c184c0258cfaa0ea8cf5ab6fa8e8` confirmed PR #41 is merged. GitHub Actions are green: `CI`, `Production Readiness Gate`, `Vercel Parity Build`, `Phi-3 Verification`, and CodeQL completed successfully.
- Vercel status for `d3bcbb3` is `success`. Active `airy-balance` Railway contexts are success. Stale `illustrious-warmth` contexts still appear as no-op success statuses and should not be treated as release gates, but branch-protection required-check cleanup still needs manual admin confirmation.
- Earlier API origin and health diagnosis on `d3bcbb3` found production `/api/health` returning `503` with `checks.database: "down"`; this is superseded by the 2026-06-26 runtime verification showing readiness `200` with database `up`.
- Health source already has a liveness/readiness split. Readiness imports `@/lib/db` and runs Prisma `SELECT 1` through `DATABASE_URL`; `DIRECT_URL` is not used by this runtime check.
- Because the health query is `SELECT 1`, the DB-down result is unlikely to be caused by application schema drift itself. The likely class is Vercel Production `DATABASE_URL` missing/wrong/unreachable, SSL/pooler mismatch, or a runtime DB client/connectivity error that requires redacted dashboard/runtime logs.
- `/api/proxy/health` returns `401 Unauthorized` before proxying. This is expected because generic `/api/proxy/*` is not public in `apps/web/src/proxy.ts`; only specific public proxy prefixes are allowlisted.
- `API_INTERNAL_ORIGIN` value shape must be an absolute Vercel-reachable origin such as `https://<active-api-service-or-custom-domain>`. Latest status metadata exposes Railway service dashboard URLs only; older `convospan-api-split-production.up.railway.app` evidence remains a candidate, not a confirmed final value.
- Local validation for this phase passed: `npm run typecheck --workspace apps/web` in 65.5s, `npm run typecheck --workspace apps/api` in 86.4s, `npm run build --workspace apps/api` in 94.5s, and `npm run build --workspace apps/web` in 854.6s with dummy local DB URLs and CI placeholder auth env.
- Post-PR39 smoke on latest main `6d012102ebfeff47e8a95cf72fda5955a76aee1e` confirmed PR #39 is merged and requested GitHub Actions are green: `CI`, `Production Readiness Gate`, `Vercel Parity Build`, `Phi-3 Verification`, and CodeQL checks completed successfully.
- Vercel status for `6d01210` is `success`. Railway statuses are also `success`, but both `illustrious-warmth` stale contexts still appear on the new commit with no-op "No deployment needed" messages.
- `Register Docker Images to GHCR` did not run for the PR #39 docs-only merge because `.github/workflows/docker-ghcr.yml` path filters do not include docs. This should be resolved by the release-gate policy decision rather than treated as implicit production image evidence.
- Production custom-domain Chromium smoke on `/`, `/funnel`, `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/terms`, `/contact`, and `/login` returned public `200` responses with zero `/api/auth/session` calls, zero `/api/auth/_log` calls, zero `/api/proxy` calls, and no console/page errors.
- `/dashboard` on `www.craftmyfunnel.live` redirects unauthenticated users to `/login?callbackUrl=%2Fdashboard`, preserving the expected auth gate.
- Direct production `/api/auth/session` returns `200 OK` with `{}`. Direct `/api/proxy` and `/api/proxy/health` return `401 Unauthorized`, which confirms unauthenticated middleware protection but does not prove `API_INTERNAL_ORIGIN`.
- Direct production `/api/health` returns `503 Service Unavailable` with `checks.database: "down"`, which is a release-readiness blocker requiring dashboard/env/DB verification without production data mutation.
- Local validation for the post-PR39 smoke branch passed: `npm run typecheck --workspace apps/web` in 75.3s, `npm run typecheck --workspace apps/api` in 88.6s, `npm run build --workspace apps/api` in 92.8s, and `npm run build --workspace apps/web` in 962.5s with dummy local DB URLs and CI placeholder auth env.
- Issue #38 audit on latest main `bbd3d472f64ccc9c6ca52be50ddc651bd33d6e73` found active `airy-balance` Railway contexts green, but stale `illustrious-warmth` contexts still present; `illustrious-warmth - convospan-full-scaffold` is failing.
- Branch protection required status checks could not be read from available tooling; GitHub REST returned `401 Unauthorized`. Manual cleanup path is documented in `docs/audits/stale-railway-check-removal.md`.
- The next phased production-readiness improvement plan is documented in `docs/plans/next-phased-production-improvements.md`.
- Latest main `Register Docker Images to GHCR / build-and-push` no longer fails at the web Docker/nodemailer build step; the web image build succeeds and the current failure occurs at Trivy scanning.
- Validation for the Issue #38 docs PR: web typecheck passed, root `npm ci --no-audit --no-fund` passed, API Prisma generate passed with dummy local DB URLs, API typecheck passed, API build passed, and optional web build passed in 1182.8s.
- Web Docker GHCR hotfix found that `nodemailer@9.0.1` is correctly declared in `apps/web/package.json` and installed at `apps/web/node_modules/nodemailer`; root `node_modules/nodemailer` is absent.
- The failing GHCR web Docker build copied only `/repo/node_modules` from the deps stage to the builder stage, so `npx next build` could not resolve the web workspace-local `nodemailer` dependency.
- Minimal Dockerfile fix copies `/repo/apps/web/node_modules` from deps to builder before running the Next build. No package versions, lockfiles, app source, SMTP behavior, or workflow policy were changed.
- Local validation for the Docker hotfix: `npm audit --audit-level=high --omit=dev` passed, `npx -p npm@10 npm ci --dry-run --loglevel=error` passed, `npm ls/explain nodemailer --workspace apps/web` confirmed workspace-local install, `npm run typecheck --workspace apps/web` passed, and `npm run build --workspace apps/web` passed in 858.0s.
- Local Docker validation is blocked because Docker is not installed on this Windows environment; `.github/workflows/docker-ghcr.yml` does not run on ordinary PR branch pushes, so GHCR must be confirmed by manual `workflow_dispatch` or the post-merge `main` push.
- PR #37 head `bc52b95ff814d7763bd5eb3d692905100c669932` has green normal PR checks, but GitHub Actions API did not expose a post-fix `Register Docker Images to GHCR` workflow_dispatch run for the branch/head during recheck.
- A PR-safe trigger was added to `.github/workflows/docker-ghcr.yml` so PR #37 can produce a visible `Register Docker Images to GHCR` run without logging in to GHCR or pushing production images on pull_request events.
- Post-PR35 merge release gate recheck on latest main `e14806ca01439219fa3f93214acd07b1d3a9d042` confirmed PR #35 is included in main.
- Requested GitHub Actions are green on latest main: `CI`, `Production Readiness Gate`, `Vercel Parity Build`, and `Phi-3 Verification` all completed successfully.
- Additional main workflow `Register Docker Images to GHCR` failed at `Build Web image (no push)` because Docker `next build` could not resolve `nodemailer` from `apps/web/src/lib/email/smtpClient.ts` via `apps/web/src/app/api/support/contact/route.ts`.
- Combined commit status for latest main shows Vercel `success`, Railway `airy-balance - convospan-api-split` `success`, Railway `airy-balance - convospan-full-scaffold` `pending`, and two `illustrious-warmth` Railway services `failure`.
- Production custom-domain Chromium smoke on `/`, `/funnel`, `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/help`, and `/faq` returned `200` and observed zero `/api/auth/session` requests and zero NextAuth/session console errors.
- `/dashboard` on the production custom domain redirects unauthenticated users to `https://www.craftmyfunnel.live/login?callbackUrl=%2Fdashboard`.
- `apps/web/src/proxy.ts` still preserves intended public `/p/*` behavior with `"/p"` in `publicPaths` and `path.startsWith("/p/")` in `isPublic`.
- `npm audit --audit-level=high --omit=dev` passes on latest main with only low/moderate dependency findings remaining.
- Root npm ci lockfile sync repair on 2026-06-23 used base `7fcfff7eee29f7dbc37aa9623faab0c1924c67f7`, where PR #33 had reverted the PR #32 Dependabot grouped bump.
- The visible `vercel-parity-build` failure was reproduced with `npx -p npm@10 npm ci --no-audit --no-fund --loglevel=error`; npm 10 reported missing root lockfile entries for `@emnapi/core@1.11.1`, `@emnapi/runtime@1.11.1`, and `uuid@14.0.1`.
- The fix was lockfile-only: `npx -p npm@10 npm install --package-lock-only --ignore-scripts --no-audit --no-fund --loglevel=error` updated root `package-lock.json` without changing package manifests.
- Validation passed with `npx -p npm@10 npm ci --no-audit --no-fund` in 789.2s, local `npm ci` in 847.2s, `node scripts/check-web-prisma-imports.mjs` in 5.2s, web Prisma generate in 35.0s, and web build in 917.5s. The local `vercel-parity-build` lockfile blocker is READY_FOR_NEXT_STAGE, but GitHub Actions still need to run green on the target branch before the CI blocker is fully closed.
- `@emnapi/core@1.11.1` and `@emnapi/runtime@1.11.1` are now present in root `package-lock.json`; dependency-chain proof points to `@napi-rs/wasm-runtime` peers used by optional WASI bindings under `rolldown`/`vite` and `unrs-resolver`/`eslint-config-next`.
- PR #35 security-audit follow-up found both failing web jobs ran `npm audit --audit-level=high --omit=dev`; high blockers were `nodemailer <=9.0.0` and `ws 8.0.0 - 8.20.1`.
- Targeted high-audit fix updated `nodemailer` to `^9.0.1` in web/API package manifests and resolved `ws` to `8.21.0` through a root override plus transitive lock updates for `engine.io@6.6.9` and `socket.io-adapter@2.5.8`.
- Local validation after the PR #35 high-audit fix: `npm audit --audit-level=high --omit=dev` passed with only low/moderate findings remaining, `npx -p npm@10 npm ci --dry-run --loglevel=error` passed, web typecheck passed after Prisma generate, and web build passed in 945.8s.
- GitHub rerun on PR #35 head `b08bf9579a7ee5122f8f806ca3387f79ff5666e6` confirmed Security Audit passed in both web workflows; `Vercel Parity Build` passed, Vercel preview passed, and Netlify preview passed.
- The same rerun then failed later at `tests/unit/landing-agent-routing-regression.test.ts` because the regression test expected `path.startsWith("/p/")` in `apps/web/src/proxy.ts`; the proxy already had equivalent public-route behavior via `cleanPath.startsWith("/p/")`. A one-line guard alignment was applied and the targeted unit test now passes locally.
- Dependency security and GitHub alert remediation were added on 2026-06-23 as a separate release blocker. It must run before DB performance/security hardening or final readiness.
- High severity current alerts are `ws` alert #250, `picomatch` alert #158, and `nodemailer` alert #261. These block final readiness unless fixed or proven unreachable in production.
- Moderate alerts now require explicit reachability/risk mapping: `brace-expansion` alert #24, `uuid` alerts #262/#216/#105, `postcss` alerts #182/#54, `picomatch` alerts #161/#160, `@hono/node-server` alerts #170/#36, and `@opentelemetry/core` alert #255.
- Dependency-security guardrails forbid `npm audit fix --force`, blind upgrades of Prisma/NextAuth/Next.js/Clerk/React/Prisma adapter packages, downgrades to hide alerts, production env changes, DB/schema edits, migrations, Redis changes, Clerk dashboard changes, and PR #6 changes.
- Post-env-redeploy verification on 2026-06-22 used head commit `ef4eaf27d2796671927dfc68a082731547fd1d04`.
- User updated Vercel environment variables and redeployed Production (deployment `5147697018` at branch `main`).
- Direct `/api/auth/session` now returns `200 OK` with `{}` on the custom production domain, indicating the NextAuth `NO_SECRET` blocker is resolved. NextAuth client errors on public pages are no longer emitted.
- Public pages still call `/api/auth/session` because production is serving branch `main` rather than the Codex branch.
- Earlier post-env-redeploy verification found `API_INTERNAL_ORIGIN` unset; this is superseded by the 2026-06-26 runtime verification confirming the public Railway origin and leaving only authenticated proxy-flow proof pending.
- Post-revert triage on latest main `094663f21804fa858a28763af9a0f0e0383b4880` found Vercel status `success`, Railway `airy-balance - convospan-api-split` `success`, and three failing Railway statuses: `airy-balance - convospan-full-scaffold`, `illustrious-warmth - convospan-api-split`, and `illustrious-warmth - convospan-full-scaffold`.
- No committed Railway config (`railway.toml`, Nixpacks, Railpack, or Procfile) was found; Railway service build/root/start/healthcheck/env mapping must be verified in the Railway dashboard.
- Latest main still contains PR #25 public session-free provider routes and PR #23 is an ancestor of `origin/main`.
- Local validation on latest main passed: `npm run typecheck --workspace apps/web`, `npm run typecheck --workspace apps/api`, `npm run build --workspace apps/api`, and `npm run build --workspace apps/web`. Docker/Railway-style image build could not be run locally because Docker is not installed.
- `API_INTERNAL_ORIGIN` must be the canonical absolute backend API origin for production web proxy requests. The repo does not prove whether the correct value is the observed Railway API service host, a custom API domain, or another dashboard-managed backend origin.
- Latest-main release gate recheck on `a232648be04aae66ed89c6779503486bd76d32a4` found Vercel `success` and all Railway contexts `success` with `No deployment needed - watched paths not modified`.
- GitHub Actions still fail on latest main: `Web Build (apps/web)`, `vercel-parity-build`, and `Production Stability Audit (apps/web)`. `build-and-push` was not present for this docs-only commit.
- Direct production `https://www.craftmyfunnel.live/api/auth/session` returned `200 OK` with `{}` using public HTTPS SNI/DNS override.
- Local validation on latest main passed: web typecheck, API typecheck, API build, and web build. Web build completed in 917.7s.
- Local `npm audit --workspace apps/web --audit-level=high --omit=dev` fails with 18 vulnerabilities including 6 high, matching the kind of blocking gate present in the failing web/stability workflows.
- Exact CI `npx prisma generate --config prisma/prisma.config.ts --schema prisma/schema.prisma` passed locally with dummy DB URLs, so `vercel-parity-build`'s Prisma-generation annotation remains CI-specific until full logs are inspected.
- Rebaseline on 2026-06-22 used `origin/codex/db-linkage-swarm-orchestration` commit `9788d84db4afce78964aa9da90b22d606ef988a2`.
- GitHub commit status for `9788d84` returned Vercel `success` with description `Deployment has completed`; GitHub deployments listed preview URL `https://fullstack-web-xkxn-jifhkvhbk-convo2026s-projects.vercel.app`, but that immutable preview URL is Vercel SSO-protected (`401`).
- Local DNS maps `www.craftmyfunnel.live` and `craftmyfunnel.live` to `127.0.0.1`; live checks bypassed this with public HTTPS SNI/TLS using `curl --resolve ...:76.76.21.21`.
- Custom domain freshness verdict: `www.craftmyfunnel.live` appears to serve the requested `9788d84` public-route and approval-content behavior; `craftmyfunnel.live` redirects to `https://www.craftmyfunnel.live/`.
- Required public URLs `/`, `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/terms`, `/contact`, and `/funnel` all returned public `200` without login redirects.
- Old approval email values `bizcomm.soulutions@gmail.com`, `support@craftmyfunnel.com`, and `enterprise@craftmyfunnel.com` were absent from the checked public pages; `support@craftmyfunnel.live` was present where expected.
- Frontend smoke found homepage and `/funnel` render on desktop and mobile, with no CinematicHome, GSAP, Lenis, or React Three Fiber crash observed; Chromium emitted WebGL performance warnings only.
- Frontend smoke risk remains: public pages emitted NextAuth `/api/auth/session` client errors with `500` or `429`, including on `/funnel` and approval pages.
- Validation results on `9788d84`: `npm run typecheck --workspace apps/web` passed; `npm run lint --workspace apps/web` timed out after 180s; `npm run build --workspace apps/web` timed out after 600s.
- Auth session runtime recheck on 2026-06-22 reproduced direct production `/api/auth/session` `500`; response matched local web route `X-Matched-Path: /api/auth/[...nextauth]`.
- Vercel runtime logs for `fullstack-web-xkxn` showed NextAuth `NO_SECRET` on `/api/auth/session` and `/api/auth/_log`, classifying the server-side failure as env-driven (`NEXTAUTH_SECRET` missing/unavailable).
- Public page session noise was also code-driven: `apps/web/src/app/providers.tsx` did not list `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/funnel`, `/help`, or `/faq` in `sessionFreePrefixes`, so those fully public pages mounted `SessionProvider`.
- Minimal source fix added those public trust/help/funnel routes to the session-free list. Protected dashboard/app routes still mount `SessionProvider`; auth rules were not weakened.
- Local production smoke after build verified `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, and `/funnel` returned `200`, made zero `/api/auth/session` requests, and emitted no NextAuth console errors.
- Validation after the auth/session fix: typecheck passed in 212.4s, lint passed in 182.3s with one warning, and build passed in 805.2s.
- Vercel env key presence remains blocked: connector exposes project/log metadata but no env listing; local CLI is linked to a different `fullstack` project and wrong scope. `NEXTAUTH_SECRET` is missing or unavailable by runtime-log evidence.
- GitHub Actions status remains not green for the current head: GitHub API returned older branch workflow runs, but no Actions run/check-run was found for `94a23d`; only Vercel/Supabase app check runs were found on the current commit.
- Post-deploy smoke on 2026-06-22 for `c3cbfbf48a353a3bf8ee1202b15cbb09e3f7632e`: GitHub/Vercel commit status is `success`; deployment `5147717423` status is `success`; preview URL is `https://fullstack-web-xkxn-gjs0zzkhv-convo2026s-projects.vercel.app`.
- Custom-domain freshness did not pass for the auth/session fix: `www.craftmyfunnel.live` still requested `/api/auth/session` and `/api/auth/_log` on `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/funnel`, `/help`, and `/faq`.
- Fresh production runtime logs for the smoke window identify deployment `dpl_8rrycQGHzaBXXPCkLQK2dS2fxWYH`, domain `www.craftmyfunnel.live`, environment `production`, branch `main`, with NextAuth `NO_SECRET`.
- Direct `https://www.craftmyfunnel.live/api/auth/session` still returns `500` with `X-Matched-Path: /api/auth/[...nextauth]`.
- GitHub Actions API now returns older branch workflow runs, but no Actions run/check-run was found for current commit `94a23d`; required Actions are still not proven green for the current head.
- Current head `94a23d55c0e9ce14e6593d5feb3c74e63d2db3d6` has GitHub/Vercel commit status `success` and Preview deployment `5148021525` at `https://fullstack-web-xkxn-7cqon4bc4-convo2026s-projects.vercel.app`.
- GitHub Production deployment evidence still points away from the Codex branch: latest observed Production deployment `5147697018` uses SHA `4367d7bc374d4a6db9151b00bc40078fca1e2416`, environment `Production`, created `2026-06-22T07:27:20Z`.
- Vercel project metadata shows latest deployment `dpl_CbD5LeM4MdHz8VAPVA9S6pkrE9qU` for the Codex preview with `target: null` and project `live: false`; custom domains remain configured separately on the project.
- The safe production path is to add or repair `NEXTAUTH_SECRET` in Vercel Production, then move only the minimal public-page session fix to `main` through PR/cherry-pick after required checks. Do not promote the full Codex preview as-is.
- GitHub Actions status for current head `94a23d` is still missing: only `Vercel Preview Comments` success and `Supabase Preview` skipped check-runs were found; no Actions run/check-run for lint/typecheck/build/tests was found.
- Vercel project `fullstack-web-xkxn` / `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` is linked to `Convospanai-outreach/fullstack`.
- Latest Vercel deployment inspected was `READY` from `codex/db-linkage-swarm-orchestration`; recent production deployments from `main` were also `READY`, but readiness is not proven by deploy state.
- Supabase project `Fullstack2026` / `izqcycslipmbgdwgajvu` is `ACTIVE_HEALTHY` on Postgres 17.
- Live Supabase schema fingerprint: `c277e899b339aeb93d8dfaef77426b78`.
- Live DB has 90 public tables and 17 Prisma migration rows.
- Local migration directories exceed live: web 25, API 22.
- Live DB is missing `User.clerk_user_id`, `UserInvitation`, and `invite_requests`, while web Clerk auth depends on them.
- `Lead.embedding` is nullable `text` live; vector extension is installed.
- `20260604140000_edge_runtime_pairing` includes `DELETE FROM "EdgeNode"` and must not run in production as-is.
- Vercel runtime logs showed recent production `200` responses for `/` and `/login`; local DNS maps custom domains to `127.0.0.1`, so direct local smoke checks were not reliable.
- PR #2 is focused but `mergeable=false`; PR #6 is broad, `mergeable=false`, and must be split.
- Implementation REPLAN from commit `d3086c094d145eed0b7f5a5c7eed495bd302fb19` is documented in `docs/codex/IMPLEMENTATION_REPLAN_D3086C0.md`.
- Shared production DB should use a single canonical Prisma schema; `apps/web/prisma/schema.prisma` is only a temporary reference candidate while the architecture moves toward `packages/db/prisma/schema.prisma`.
- Unsafe migration `20260604140000_edge_runtime_pairing` is quarantined for production because it deletes orphaned `EdgeNode` rows.
- Additive auth/onboarding repair is planned for `User.clerk_user_id`, `UserInvitation`, and `invite_requests`; no production migration has been generated or applied.
- Vercel deployment for commit `3b2d7069ac839a5559fa729f28ab913954e52dea` failed because Next.js typechecked `apps/web/src/scripts/verify-schema-readiness.ts` and the repo lacks `@types/pg`.
- The read-only verifier has moved to `scripts/db/verify-schema-readiness.mjs`; `apps/web/src/scripts/verify-schema-readiness.ts` was removed so Vercel does not typecheck it as app code.
- Root scripts now expose `npm run schema:verify:readonly` and `npm run schema:verify:production`.
- Production verifier mode requires expected migration count, latest migration, schema fingerprint, and either expected migration names or a manifest path.
- Migration manifest format exists at `scripts/db/migration-manifest.schema.json`; it is not enforced yet.
- Vercel deployment `dpl_8dfuT5xwLDeoHfdxQfeuqh6qTFGU` for commit `07d6736f72989a1db8e854ee38c793cc9fb437a2` is `READY`.
- Vercel build for Phase 3 commit `fc500fa7b4735c5ce8809c0dda5ead10f426759b` confirmed `READY` by user on 2026-06-18.
- Shared DB package skeleton now exists at `packages/db`.
- `packages/db/prisma/schema.prisma` is a starting snapshot copied from `apps/web/prisma/schema.prisma`; app-local schemas were not deleted or rewired.
- Schema comparison is available with `npm run db:schema:compare`; it exits non-zero on current API drift and is not wired into CI.
- Live compare output (2026-06-18): `packages/db` matches `apps/web` (MATCH); `apps/api` differs by `InviteRequest`, `UserInvitation`, `InvitationStatus`, `InviteRequestStatus` (DIFFER, expected known drift).
- Phase 4 drift matrix completed (2026-06-18): `ConnectedMailbox` naming conflicts do NOT exist in current local schemas (PR #6 concern only). `Email`, `SuppressionEntry`, `TrackedLink` are field-for-field identical across web and API. `EmailActivityLog`, `EmailTrackedLink`, `WaitlistRequest` do not exist in any local schema (PR #6 proposals only).
- `Lead.embedding` TYPE_DRIFT confirmed: web/packages=`Unsupported("vector(1536)")?`, API=`String?` (comment: "Temporarily String to match DB state"), live=`text` nullable.
- `User.clerkUserId` (`clerk_user_id`) is present in `apps/web` and `packages/db`, absent from `apps/api` User model, and absent from live Supabase.
- `UserInvitation` model present in web/packages, absent from `apps/api`, confirmed absent from live Supabase.
- `InviteRequest` model (mapped to `invite_requests`) present in web/packages, absent from `apps/api`, live state not confirmed this session.
- See `docs/audits/prisma-schema-drift-matrix.md` for full evidence and `docs/audits/schema-compare-output.md` for raw compare output.
- Phase 4 decision prep complete (2026-06-18): `docs/audits/lead-embedding-decision.md` compares Option A/B/C and recommends Option C (String/text short-term in `packages/db`; vector deferred to a future dedicated migration).
- Phase 4 decision prep complete (2026-06-18): `docs/audits/api-auth-schema-sync-plan.md` lists exact Prisma additions for `apps/api`: `User.clerkUserId`, `InvitationStatus` enum, `InviteRequestStatus` enum, `UserInvitation` model, `InviteRequest` model, and two User relations. No schema edits or migrations generated yet.
- Option B ACCEPTED by CTO (2026-06-18): `Lead.embedding` changed to `String?` in `packages/db/prisma/schema.prisma` (line 38) and `apps/web/prisma/schema.prisma` (line 38). `apps/api` was already `String?`. No migration generated; live DB column is already `text` nullable.
- Approval readiness docs created (2026-06-20): Google Workspace API approval plan, LinkedIn Chrome Web Store approval plan, and live URL approval checklist.
- Gmail OAuth code currently requests `openid`, `email`, `profile`, `gmail.send`, and `gmail.readonly`; approval plan recommends G1 send-only with `gmail.send` first and G2 `gmail.readonly` reply/bounce sync later.
- Exact Google OAuth approval endpoints documented: `/api/proxy/integrations/google/oauth/start?next=/setup?step=3` and `/api/proxy/integrations/google/oauth/callback`.
- Chrome extension approval plan recommends first submission as manual user-triggered visible LinkedIn profile capture only, with no mass automation, no background scraping, no auto-connect, and no auto-like.
- Live approval URL checklist marks all public URLs `UNKNOWN` until verified live; repo route evidence was found for privacy, terms, security, support, data deletion, Google API disclosure, contact, help, and FAQ.
- Vercel deployment for approval docs commit `6d012ea382ec324cdb73bcdcff9c5d00a843d795` is `READY`: `dpl_5S2oME2vqrWV1NdKrhsKjqZNXCF7`.
- Live approval URL verification completed on 2026-06-20. Six required URLs return public HTTPS `200`: `/`, `/privacy`, `/terms`, `/contact`, `/help`, and `/faq`.
- Four required approval URLs are not public: `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` return initial `307` redirects to `/login?callbackUrl=...`.
- Support/contact domain mismatches found: `/terms` uses `bizcomm.soulutions@gmail.com`; `/contact` uses `support@craftmyfunnel.com` and `enterprise@craftmyfunnel.com` instead of the approval-domain support address.
- Approval page fix implemented on 2026-06-20: `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` added to the public web allowlist; `/terms` and `/contact` email references standardized to `support@craftmyfunnel.live`.
- Live approval rebaseline on 2026-06-22 for commit `9788d84` passed the public approval URL gate: the required pages are public, no checked page redirects to login, and old email values were absent.
- `postgresqlExtensions` preview feature and `extensions = [vector]` datasource entry removed from `packages/db` and `apps/web` — now orphaned since no `Unsupported` types remain in either schema.
- Post-convergence compare run (2026-06-18): `packages/db` MATCH `apps/web` sha256=`3d46e8b3…`. Both DIFFER from `apps/api` on auth/invite gap only (`UserInvitation`, `InviteRequest`, `InvitationStatus`, `InviteRequestStatus`). `Lead.embedding` TYPE_DRIFT is RESOLVED.
- Sole remaining Phase 4 schema gap: auth/invite models in `apps/api`. Documented in `docs/audits/api-auth-schema-sync-plan.md`.

## Decisions

| Decision | Date | Agent | Evidence | Status |
| --- | --- | --- | --- | --- |
| Vercel READY is insufficient | 2026-06-18 | orchestrator | Deployment metadata and runtime/db blockers | ACCEPTED |
| SELECT 1 is insufficient | 2026-06-18 | runtime-db-agent | Health routes only check `SELECT 1`; schema drift exists | ACCEPTED |
| Do not run production migrations yet | 2026-06-18 | migration-safety-agent | Pending migration contains destructive delete | ACCEPTED |
| Do not merge PR #6 as-is | 2026-06-18 | pr-strategy-agent | PR #6 broad/conflicting diff | ACCEPTED |
| Shared production DB requires one canonical Prisma schema | 2026-06-18 | orchestrator | `docs/audits/prisma-canonical-schema-decision.md` | PROPOSED |
| Quarantine `20260604140000_edge_runtime_pairing` before production deploy | 2026-06-18 | migration-safety-agent | `docs/audits/unsafe-migration-quarantine.md` | ACCEPTED |
| Auth/onboarding repair must be additive and review-gated | 2026-06-18 | auth-tenant-agent | `docs/audits/auth-schema-repair-plan.md` | ACCEPTED |
| Permanent canonical schema target should be `packages/db/prisma/schema.prisma`, not `apps/web` | 2026-06-18 | orchestrator | `docs/audits/canonical-schema-architecture-plan.md` | PROPOSED |
| Migration manifest format is advisory only until explicitly enforced | 2026-06-18 | migration-safety-agent | `scripts/db/migration-manifest.schema.json` | ACCEPTED |
| `Lead.embedding` canonical type | Option B accepted: String? canonical for controlled beta | 2026-06-18 | CTO / prisma-drift-agent | `docs/audits/lead-embedding-decision.md` | ACCEPTED |
| `Lead.embedding` Option B applied | `packages/db` and `apps/web` changed to `String?`; `apps/api` already correct; postgresqlExtensions + vector extension removed from web+packages/db | 2026-06-18 | prisma-drift-agent | Schema diff + compare run | ACCEPTED |
| `Lead.embedding` vector(1536) upgrade | Deferred to a future dedicated migration phase | 2026-06-18 | CTO / prisma-drift-agent | `docs/audits/lead-embedding-decision.md` | ACCEPTED |
| `ConnectedMailbox` naming conflicts | No conflict in current local schemas | 2026-06-18 | prisma-drift-agent | Direct schema inspection | RESOLVED |
| `EmailActivityLog` / `EmailTrackedLink` / `WaitlistRequest` | Not in any current local schema; PR #6 proposals only | 2026-06-18 | prisma-drift-agent | Direct schema inspection | RESOLVED |
| `UserInvitation` + `InviteRequest` API gap | Must be added to `apps/api` — sole remaining Phase 4 blocker | 2026-06-18 | prisma-drift-agent | Phase 4 drift matrix | ACCEPTED — execution pending orchestrator go-ahead |
| API auth schema sync plan | Exact Prisma additions documented; no edits made yet | 2026-06-18 | prisma-drift-agent | `docs/audits/api-auth-schema-sync-plan.md` | ACCEPTED — execution pending orchestrator go-ahead |
| Approval readiness split | Move from DB/edge work to Google Workspace and Chrome Web Store approval docs; do not continue DB migrations | 2026-06-20 | approval-readiness-agent | `docs/audits/google-workspace-api-approval-plan.md`, `docs/audits/linkedin-chrome-store-approval-plan.md`, `docs/audits/live-url-approval-readiness-checklist.md` | ACCEPTED |
| Approval URL gate | Required approval URLs must be public before Google Workspace or Chrome Web Store submission | 2026-06-20 | approval-readiness-agent | `docs/audits/live-url-approval-readiness-output.md` | NEEDS_REPLAN |
| Public approval page fix | Public route allowlist and email-domain fixes are implemented and verified live; follow-up auth/session public-page polling fix is implemented in source and awaits deploy/recheck | 2026-06-22 | approval-readiness-agent | `docs/audits/live-url-approval-readiness-output.md`, `docs/audits/frontend-auth-session-runtime-check.md` | NEEDS_REPLAN |

## Next action queue

1. [COMPLETED] Edit `apps/api/prisma/schema.prisma` per `docs/audits/api-auth-schema-sync-plan.md`:
   - Add `User.clerkUserId` field
   - Add `User.sentInvitations` + `User.approvedInviteRequests` relations
   - Add `InvitationStatus` enum
   - Add `InviteRequestStatus` enum
   - Add `UserInvitation` model
   - Add `InviteRequest` model (@@map invite_requests)
   - Add `Team.userInvitations` relation
2. [COMPLETED] Run `npx prisma validate` on `apps/api` schema after edits.
3. [COMPLETED] Re-run `npm run db:schema:compare` — expected result: all three MATCH, exit code 0.
4. [BLOCKED_EXTERNAL_ACCESS - Phase 5] Run `live-schema-verify-plan.md` read-only verification against remote Supabase project `izqcycslipmbgdwgajvu` (blocked: missing remote connection strings).
5. [QUEUED] Generate/apply additive auth migration against staging/production DB (requires unblocking verification).
6. [QUEUED] Replace the quarantined `20260604140000_edge_runtime_pairing` path.
7. [QUEUED] Verify Vercel env keys and targets.
8. [QUEUED] Verify GitHub Actions green on target branch.
9. [QUEUED] Split PR #6 after schema strategy is stable.
10. [READY_FOR_NEXT_STAGE] Approval readiness docs-only pass completed:
   - `docs/audits/google-workspace-api-approval-plan.md`
   - `docs/audits/linkedin-chrome-store-approval-plan.md`
   - `docs/audits/live-url-approval-readiness-checklist.md`
11. [NEEDS_REPLAN] Verify required approval URLs live from the public internet:
   - Public `200`: `/`, `/privacy`, `/terms`, `/contact`, `/help`, `/faq`
   - Login-gated: `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`
   - Domain mismatch: `/terms`, `/contact`
12. [QUEUED] Prepare Google Workspace G1 send-only submission and Chrome Web Store V1 manual-capture submission artifacts after URL gate is fixed.
13. [COMPLETED] Public approval page fix verified live at commit `9788d84`:
   - Public allowlist: `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`
   - Email standardization: `/terms`, `/contact`
   - Vercel/GitHub status for `9788d84` is `success`
   - Live domain no longer shows login redirects or checked stale email values
14. [NEEDS_REPLAN] Resolve latest frontend smoke and validation gaps:
   - [FIXED IN SOURCE, NEEDS DEPLOY] Public pages emit `/api/auth/session` `500` or `429` client errors in current production; source now prevents checked public pages from polling `/api/auth/session`
   - [COMPLETED] `npm run lint --workspace apps/web` passed in 182.3s with one warning
   - [COMPLETED] `npm run build --workspace apps/web` passed in 805.2s
15. [NEEDS_REPLAN] Post-deploy production smoke for `c3cbfbf` failed:
   - `c3cbfbf` Vercel preview status is success
   - Custom domain production logs identify branch `main`
   - Public pages still call `/api/auth/session` and `/api/auth/_log`
16. [BLOCKED_EXTERNAL_ACCESS] Verify Vercel env key presence for `fullstack-web-xkxn`; runtime logs indicate `NEXTAUTH_SECRET` is missing/unavailable.
17. [NEEDS_REPLAN] Trigger or verify GitHub Actions on `94a23d`; older branch runs exist, but no Actions run/check-run was found for current commit.
18. [NEEDS_REPLAN] Deploy safely to production by first repairing `NEXTAUTH_SECRET`, then PR/cherry-picking only the minimal public-page session fix to `main` after required checks. Do not manually alias the full Codex preview as the default path.
19. [NEEDS_REPLAN] Run dependency security and GitHub alert remediation:
   - Map every listed Dependabot/npm audit alert to package, severity, direct/transitive status, dependency chain, workspace, production runtime reachability, safe fix strategy, validation command, and final verdict.
   - Fix or prove unreachable all high severity production dependency alerts without `npm audit fix --force`.
   - Keep final readiness at NEEDS_REPLAN or BLOCKED_BY_FAILED_TESTS until high alerts are resolved, lockfiles are synchronized, root `npm ci` passes, production audit gate passes, and GitHub Actions are green.

## Handoff note template

| Field | Value |
| --- | --- |
| From agent |  |
| To agent |  |
| Stage completed |  |
| Status |  |
| Files changed |  |
| Evidence |  |
| Known risks |  |
| Next action |  |
| Stop conditions |  |
