# Codex Workflow State

This file is the source of truth for current task status. Update it after every agent stage.

## Current status

| Field | Value |
| --- | --- |
| Overall status | NEEDS_REPLAN |
| Current stage | Approval readiness |
| Current agent | approval-readiness-agent |
| Working branch | codex/db-linkage-swarm-orchestration |
| Baseline commit inspected | ef4eaf27d2796671927dfc68a082731547fd1d04 |
| API Internal Origin | NOT_SET_BY_USER; backend origin unknown |
| Last updated | 2026-06-22 |
| Next action | Cherry-pick or PR only the minimal public-page session fix to `main` after checks; trigger/verify GitHub Actions status |

## Status values

Use only these values:

- NOT_STARTED
- IN_PROGRESS
- READY_FOR_NEXT_STAGE
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
| API_INTERNAL_ORIGIN not set | release-readiness-agent | User intentionally omitted API_INTERNAL_ORIGIN because backend API URL is not confirmed | Identify actual API deployment/custom API origin | NEEDS_INPUT |
| GitHub Actions green status unverified | ci-gate-agent | GitHub API accessible; older branch Actions runs exist, but no Actions run/check-run was found for current commit `ef4eaf2` covering lint/typecheck/build/tests | Trigger or configure Actions for target branch and verify required jobs | NEEDS_REPLAN |
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
| 12. CI and PR strategy | ci-gate-agent | NEEDS_REPLAN | production-readiness-final.md | CI structure exists; live Actions green not verified |
| 13. Final readiness | release-readiness-agent | NEEDS_REPLAN | production-readiness-final.md | Final status: not launch-ready |
| Implementation REPLAN d3086c0 | orchestrator | READY_FOR_NEXT_STAGE | IMPLEMENTATION_REPLAN_D3086C0.md | Produced canonical schema decision, unsafe migration quarantine, auth repair plan, and read-only schema verifier |
| Phase 1. Canonical schema architecture | orchestrator | READY_FOR_NEXT_STAGE | canonical-schema-architecture-plan.md | Moves target ownership toward `packages/db/prisma/schema.prisma`; `apps/web` remains temporary reference only |
| Phase 2. Migration safety gates | migration-safety-agent | READY_FOR_NEXT_STAGE | migration-manifest-format.md | Added advisory manifest format and root read-only verifier; unsafe EdgeNode migration not modified |
| Phase 3. Shared DB package skeleton | orchestrator | READY_FOR_NEXT_STAGE | packages/db/package.json | Added skeleton package, copied web schema as starting snapshot, added migration ownership README and schema compare gate script |
| Phase 4. Prisma drift resolution | prisma-drift-agent | READY_FOR_NEXT_STAGE | docs/audits/prisma-schema-drift-matrix.md, docs/audits/schema-compare-output.md, docs/audits/lead-embedding-decision.md, docs/audits/api-auth-schema-sync-plan.md, docs/audits/api-prisma-validate-output.md | Option B accepted (CTO). Lead.embedding=String? applied to packages/db, apps/web, and apps/api. API auth schema sync applied. All three schemas are in 100% character-for-character sync (MATCH) and validate successfully. Added API schema validate evidence. |
| Phase 5. DB verification & additive prep | prisma-drift-agent | BLOCKED_EXTERNAL_ACCESS | docs/audits/live-schema-verify-plan.md, docs/audits/auth-invite-additive-migration-plan.md, docs/audits/live-schema-verify-output.md | Created live schema verification plan and safety-reviewed additive SQL plan. Read-only live verification is blocked due to missing remote staging/production connection strings. |
| Approval readiness rebaseline 9788d84 | approval-readiness-agent | NEEDS_REPLAN | docs/audits/vercel-custom-domain-alias-check.md, docs/audits/live-url-approval-readiness-output.md, docs/audits/frontend-production-smoke-output.md | Vercel/GitHub status for `9788d84` is success. Custom domain now serves public approval URLs with expected content and no old email values. Follow-up auth/session investigation found `NEXTAUTH_SECRET` missing/unavailable in production and applied a source fix to stop checked public pages from polling `/api/auth/session`. Full local typecheck/lint/build now pass. No DB, schema, migration, production DB, unsafe EdgeNode migration, OAuth scope, Chrome permission, automation behavior, or PR #6 work performed. |
| Post-deploy auth/session smoke `c3cbfbf` | approval-readiness-agent | NEEDS_REPLAN | docs/audits/post-deploy-auth-session-smoke-c3cbfbf.md, docs/audits/frontend-auth-session-runtime-check.md, docs/audits/frontend-production-smoke-output.md, docs/audits/vercel-env-key-presence-check.md, docs/audits/github-actions-status-check.md | Vercel status for `c3cbfbf` is success and preview deployment exists, but the custom domain still requests `/api/auth/session` and `/api/auth/_log` on public pages. Fresh production logs identify custom-domain deployment as branch `main` and still show NextAuth `NO_SECRET`. No source changes made in this post-deploy smoke pass. |
| Production branch alignment `94a23d` | approval-readiness-agent | NEEDS_REPLAN | docs/audits/vercel-production-branch-alignment-check.md, docs/audits/github-actions-status-check.md, docs/audits/vercel-env-key-presence-check.md | Current Codex head `94a23d` has Vercel Preview success, but custom-domain production is branch `main`. Safe path is Production env repair plus PR/cherry-pick of only the minimal `providers.tsx` fix to `main` after checks. |
| Post-env-redeploy verification `ef4eaf2` | approval-readiness-agent | NEEDS_REPLAN | docs/audits/post-env-redeploy-auth-session-check.md, docs/audits/vercel-production-branch-alignment-check.md, docs/audits/vercel-env-key-presence-check.md, docs/audits/github-actions-status-check.md | Vercel Production successfully redeployed by user with env updates. Direct `/api/auth/session` now returns `200 OK` on custom domain. Blocker resolved. Public pages still poll session because production serves `main`. `API_INTERNAL_ORIGIN` is not set and remains an API-backed feature blocker. |

## Latest findings

- Post-env-redeploy verification on 2026-06-22 used head commit `ef4eaf27d2796671927dfc68a082731547fd1d04`.
- User updated Vercel environment variables and redeployed Production (deployment `5147697018` at branch `main`).
- Direct `/api/auth/session` now returns `200 OK` with `{}` on the custom production domain, indicating the NextAuth `NO_SECRET` blocker is resolved. NextAuth client errors on public pages are no longer emitted.
- Public pages still call `/api/auth/session` because production is serving branch `main` rather than the Codex branch.
- `API_INTERNAL_ORIGIN` is intentionally not set and remains an API-backed feature blocker.
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
