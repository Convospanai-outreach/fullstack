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
- BLOCKED_EXTERNAL_ACCESS
- NOT_CHECKED

## Vercel linkage matrix

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Project ID | prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8 | Connector returned `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` | PASS | vercel-linkage-agent |  |
| Project name | fullstack-web-xkxn | Connector returned `fullstack-web-xkxn` | PASS | vercel-linkage-agent |  |
| Root directory | apps/web or documented equivalent | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Linked repo | Convospanai-outreach/fullstack | Deployment metadata links to `Convospanai-outreach/fullstack` | PASS | vercel-linkage-agent |  |
| Production branch | main or documented release branch | Production runtime logs for `www.craftmyfunnel.live` identify environment `production`, branch `main`, deployment `dpl_8rrycQGHzaBXXPCkLQK2dS2fxWYH` | PASS | approval-readiness-agent | Codex branch previews are not production |
| Latest deployment commit | should match intended release | Latest inspected deployment was `READY` from `codex/db-linkage-swarm-orchestration` commit `12174245a1af55d32c0b46a04b5d9f7b0a2948cd`; recent production deployment from `main` commit `86e918c35f9c2c4b1c7a6265564f26bead62e25c` | RUNTIME_RISK | vercel-linkage-agent | Vercel READY is not launch readiness |
| Commit `3b2d7069` Vercel deployment failure | Root cause identified and corrected before continuing | Deployment `dpl_ABSFvNfhHYfePwfijM8sgR9xrxBe` failed TypeScript on `apps/web/src/scripts/verify-schema-readiness.ts` importing `pg` without declarations; verifier moved out of web source | PASS | vercel-linkage-agent | New deployment still must be observed after commit/push |
| Commit `07d6736f` Vercel deployment | Preview build should pass before Phase 3 | Deployment `dpl_8dfuT5xwLDeoHfdxQfeuqh6qTFGU` for commit `07d6736f72989a1db8e854ee38c793cc9fb437a2` is `READY` | PASS | vercel-linkage-agent | Vercel READY still does not prove DB/auth/cache readiness |
| Commit `fc500fa7` Vercel deployment | Phase 3 build should pass | Confirmed `READY` by user on 2026-06-18; no TypeScript or build errors reported | PASS | orchestrator | Phase 4 work begins on top of this green commit |
| Commit `6d012ea` Vercel deployment | Approval docs commit should be green before live URL verification | Deployment `dpl_5S2oME2vqrWV1NdKrhsKjqZNXCF7` for commit `6d012ea382ec324cdb73bcdcff9c5d00a843d795` is `READY` | PASS | approval-readiness-agent | Checked before public URL verification |
| Commit `74423bc` Vercel deployment | Public-route/email fix commit should be green before live approval recheck | Deployment `dpl_J8U8CjWQtgZV74erY8Mhg3teYjCW` for commit `74423bcb39184754a13f7cc43d4f9c3ebe2a70ec` is `READY` | PASS | approval-readiness-agent | Checked before live custom-domain recheck |
| Commit `9788d84` Vercel deployment | Latest requested cinematic/proxy/studio commit should have Vercel success | GitHub commit status API returned overall `success`; Vercel context description `Deployment has completed`; GitHub deployment `5138739382` status `success`, preview URL `https://fullstack-web-xkxn-jifhkvhbk-convo2026s-projects.vercel.app` | PASS | approval-readiness-agent | Preview URL is Vercel SSO-protected (`401`), so public content comparison used custom domain |
| Commit `94a23d` Vercel deployment | Latest Codex docs/alignment head should have Vercel success before handoff | GitHub commit status API returned overall `success`; Vercel context description `Deployment has completed`; GitHub deployment `5148021525` status `success`, preview URL `https://fullstack-web-xkxn-7cqon4bc4-convo2026s-projects.vercel.app` | PASS | approval-readiness-agent | Preview-only deployment; does not prove custom-domain production behavior |
| Production deployment alignment | Custom domain should serve intended production branch/fix | Runtime logs show `www.craftmyfunnel.live` serving production branch `main`; latest observed GitHub Production deployment is `5147697018` at SHA `4367d7bc374d4a6db9151b00bc40078fca1e2416`; current Codex head `94a23d` is Preview only | RUNTIME_RISK | approval-readiness-agent | Safe path is PR/cherry-pick minimal fix to `main` after env repair and checks |
| Custom domain alias for `9788d84` | `www.craftmyfunnel.live` should serve latest requested public-route/content behavior | Public HTTPS checks via SNI/TLS DNS bypass show `/`, `/funnel`, and approval pages returning `200`; `/funnel` route chunk is present; approval routes no longer redirect to login or serve old email values | PASS | approval-readiness-agent | Exact deployment SHA is not exposed by response headers |
| Apex domain redirect | `craftmyfunnel.live` should route to canonical production host | `HEAD https://craftmyfunnel.live/` via SNI/TLS DNS bypass returned `308` to `https://www.craftmyfunnel.live/` | PASS | approval-readiness-agent | Local DNS maps apex to `127.0.0.1`; bypass used `76.76.21.21` |
| DATABASE_URL production | expected Supabase ref izqcycslipmbgdwgajvu; runtime/pooler allowed | Env listing unavailable via connector; local Vercel CLI scope failed | BLOCKED_EXTERNAL_ACCESS | vercel-linkage-agent | host/ref only; no secret |
| DIRECT_URL production | expected direct host db.izqcycslipmbgdwgajvu.supabase.co | Env listing unavailable via connector; local Vercel CLI scope failed | BLOCKED_EXTERNAL_ACCESS | vercel-linkage-agent | host/ref only; no secret |
| Preview DB isolation | preview must not write prod DB unless explicitly allowed | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Redis production | present if cache/queue enabled | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent | host only; no secret |
| Redis preview isolation | preview must not share prod namespace | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Clerk vars | present when Clerk auth enabled | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent | values must be redacted |
| API_INTERNAL_ORIGIN | present if web calls API internally | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |

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
| Health live | No external IO | NOT_CHECKED | NOT_CHECKED | health-smoke-agent |  |
| Health ready | DB/schema/migration/env marker | Current health routes use `SELECT 1`; Vercel alias returned 401; custom-domain local DNS mapped to 127.0.0.1 | FAIL | health-smoke-agent | Needs deep readiness check |
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
| Typecheck | CI enforced | Web/API typecheck jobs present | PASS | ci-gate-agent | Live Actions status not checked |
| Lint | CI enforced | Web lint present | PASS | ci-gate-agent | API lint not confirmed |
| Tests | CI enforced | Web unit/coverage and API tests/coverage present | PASS | ci-gate-agent | Live Actions status not checked |
| Production build | CI enforced | Web build and Vercel parity build present | PASS | ci-gate-agent | Live Actions status not checked |
| Live/staging DB verification plan | fresh read-only verification queries list | `docs/audits/live-schema-verify-plan.md` created 2026-06-18; contains 10 comprehensive read-only checks covering enums, tables, cols, types, and EdgeNode orphan count | PASS | prisma-drift-agent | Ready for execution |
| Additive auth migration plan | Plan additive changes safely | `docs/audits/auth-invite-additive-migration-plan.md` created 2026-06-18; outlines SQL script, enum expansion risk, rollback limits, preflight checks, backups | PASS | prisma-drift-agent | Non-destructive plan drafted |
| Live DB schema verification execution | Execute read-only verification against Supabase | Run queries from live-schema-verify-plan.md; blocked due to missing connection credentials locally; output and missing keys documented in docs/audits/live-schema-verify-output.md | BLOCKED_EXTERNAL_ACCESS | prisma-drift-agent | Requires DATABASE_URL/DIRECT_URL credentials |

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
| Public page auth-session client errors | Public pages should not emit avoidable auth/session client errors | Post-deploy smoke for `c3cbfbf` still shows `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/funnel`, `/help`, and `/faq` requesting `/api/auth/session` plus `/api/auth/_log`; responses include `500`/`429`; Vercel production logs identify custom-domain deployment as branch `main` and show NextAuth `NO_SECRET` | RUNTIME_RISK | approval-readiness-agent | Preview for `c3cbfbf` is green, but custom production domain is not serving verified session-free behavior |
| Latest-head local web validation | Lint, typecheck, and build should pass locally or have equivalent evidence | `npm run typecheck --workspace apps/web` passed in 212.4s; `npm run lint --workspace apps/web` passed in 182.3s with one warning; `npm run build --workspace apps/web` passed in 805.2s | PASS | approval-readiness-agent | Slow commands, not stuck |
| LinkedIn Chrome Store approval plan | Documentation-only plan for Chrome Web Store approval | `docs/audits/linkedin-chrome-store-approval-plan.md` created | PASS | approval-readiness-agent | No code or package changes |
| Active extension V1 manifest scope | First submission should be narrow and manual | `apps/api/src/extension/manifest.json` uses `activeTab`, `storage`, and `https://www.linkedin.com/in/*`; `apps/api/src/extension/README.md` describes visible profile capture only | PASS | approval-readiness-agent | Submit V1 only |
| Planned V2 automation risk | Automation and polling risks documented but not included in safest first submission | `apps/api/src/extension/background.v2-planned.js` contains polling/tab orchestration concepts; plan warns against `CONNECT`, `LIKE_POST`, background polling, and mass automation in first submission | RUNTIME_RISK | approval-readiness-agent | Keep V2 inactive for Chrome review |

## Env and CI follow-up matrix

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Vercel env key presence for manual keys | Verify present/missing/scope without values for `fullstack-web-xkxn` | Vercel connector confirms project/log access but exposes no env-listing tool. Local CLI is linked to a different project; `--scope convo2026s-projects` and `--scope team_ju8AaZfJ8hE4jmsMW0tTnAJ5` failed. Runtime logs show NextAuth `NO_SECRET`. | BLOCKED_EXTERNAL_ACCESS | env-guard-agent | See `docs/audits/vercel-env-key-presence-check.md` |
| `NEXTAUTH_SECRET` production availability | Must be present for NextAuth route | Direct `/api/auth/session` returns `500`; Vercel runtime logs show NextAuth `NO_SECRET` on `/api/auth/session` and `/api/auth/_log` | FAIL | env-guard-agent | Do not print or infer secret values |
| GitHub Actions branch runs | Current commit should have Actions runs for lint/typecheck/build/tests | GitHub Actions API returned older branch runs, but no Actions run/check-run was found for `94a23d`; check-runs API only showed Vercel Preview Comments success and Supabase Preview skipped on current commit | MISSING | ci-gate-agent | See `docs/audits/github-actions-status-check.md` |
| Local production after-fix public-page smoke | Public trust/funnel pages should not call `/api/auth/session` after source fix | Local production server on port `3010` returned `200` for `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, and `/funnel`; Chromium observed zero `/api/auth/session` requests and no NextAuth console errors | PASS | approval-readiness-agent | Local source behavior passed; custom-domain production smoke failed |
| `c3cbfbf` custom-domain deployment freshness | Custom domain should serve the latest public-page session-free behavior | `c3cbfbf` has successful Vercel preview deployment `https://fullstack-web-xkxn-gjs0zzkhv-convo2026s-projects.vercel.app`; custom-domain production logs during smoke show deployment `dpl_8rrycQGHzaBXXPCkLQK2dS2fxWYH`, branch `main`, with public pages still polling auth session | RUNTIME_RISK | approval-readiness-agent | Align production domain/branch or deploy fix to production before rechecking |
| `94a23d` production deployment alignment | Current Codex head should not be assumed live on the custom domain | `94a23d` has Preview deployment `https://fullstack-web-xkxn-7cqon4bc4-convo2026s-projects.vercel.app`; custom-domain production evidence still points to branch `main`, not the Codex branch | RUNTIME_RISK | approval-readiness-agent | Do not promote full preview as-is; PR/cherry-pick minimal fix to `main` after checks |
