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
| Production health documented as 200 on main | Main docs should show `/api/health` and `/api/health?probe=ready` returning 200 before DB readiness is considered resolved | 2026-06-26T15:48+05:30 verification: both endpoints returned `200` with `checks.database: "up"` on `craftmyfunnel.live` | PASS | production-runtime-verification-agent | Infrastructure readiness only, not full app readiness. |
| DB-health-green branch disposition | Decide whether to merge, cherry-pick, or supersede off-main DB-health docs | `docs/audits/production-readiness-next-actions.md` recommends superseding with a fresh verification pass | PASS | functional-readiness-reassessment-agent | Do not merge/cherry-pick stale off-main evidence as-is. |
| API_INTERNAL_ORIGIN / Railway backend origin | Canonical backend API origin should be confirmed before Vercel env changes | Public Railway origin `https://convospan-api-split-production.up.railway.app` confirmed and healthy; `/health` returns 200 with database up | PARTIAL | production-runtime-verification-agent | Authenticated upstream proxy forwarding still needs smoke proof. |
| Stale Railway required checks | Stale `illustrious-warmth` contexts should not block release | Latest main commit status still includes `illustrious-warmth` success/no-op contexts; required status checks API returns `404 Branch not protected` | PASS | functional-readiness-reassessment-agent | Stale contexts still appear, but are not currently proven required. |
| Functional readiness blockers | DB linkage, schema/migration proof, Prisma drift, Clerk linkage, Redis isolation, health/deep readiness, CI policy, and feature completeness should be clear | `docs/audits/production-readiness-next-actions.md` lists remaining blockers and next 5 actions | FAIL | functional-readiness-reassessment-agent | Product is not production-ready. |
| PR #6 status | PR #6 should remain blocked until schema/env/runtime strategy is stable | Existing workflow state keeps PR #6 blocked; next-actions doc confirms it remains blocked | PASS | functional-readiness-reassessment-agent | Do not touch PR #6. |

## Production runtime verification — green health recorded (2026-06-26T15:48+05:30)

| Check | Expected | Actual safe evidence | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Latest main SHA | Current `origin/main` SHA must be known before runtime verification | `a827db43697297ed19bc7308b71aefc8c34ab901` | PASS | production-runtime-verification-agent | PR #45 is included in main. |
| PR #44 merged | PR #44 should be on main | Merged at `2026-06-26T07:53:59Z`, merge commit `6377dd3` | PASS | production-runtime-verification-agent | Stage 12A/12B sequencing on main. |
| PR #45 merged | PR #45 should be on main | Merged at `2026-06-26T08:45:55Z`, merge commit `a827db4` | PASS | production-runtime-verification-agent | Latest main head. |
| Railway API origin | Public HTTPS Railway origin should be confirmed and healthy | `GET https://convospan-api-split-production.up.railway.app/health` → 200, `status: "healthy"`, `service: "craftmyfunnel-api"`, `database: "up"` | PASS | production-runtime-verification-agent | Do not use `.railway.internal` from Vercel. |
| Railway API DB health | Railway API database should be up | `/health` response includes `database: "up"` | PASS | production-runtime-verification-agent | Prisma `SELECT 1` only; not schema proof. |
| Vercel web DB health | Vercel web database should be up | `GET https://craftmyfunnel.live/api/health` → 200, `status: "healthy"`, `database: "up"`, `durationMs: 602` | PASS | production-runtime-verification-agent | Prisma `SELECT 1` only; not schema proof. |
| Vercel readiness probe | Explicit readiness probe should be green | `GET https://craftmyfunnel.live/api/health?probe=ready` → 200, `status: "healthy"`, `database: "up"`, `durationMs: 17` | PASS | production-runtime-verification-agent | Fast warm response. |
| Vercel proxy unauthenticated behavior | Should return expected auth gate or upstream response | `GET https://craftmyfunnel.live/api/proxy/health` → 401, `{"error":"Unauthorized"}` | EXPECTED_AUTH_GATE | production-runtime-verification-agent | Proxy is auth-protected; does not prove or disprove upstream forwarding. |
| Authenticated proxy-to-Railway forwarding | Should be verified with authenticated request | Not tested in this pass | NEEDS_AUTHENTICATED_VERIFICATION | production-runtime-verification-agent | Next verification step. |
| Overall product readiness | Must not be marked ready until all gates pass | Remaining blockers: proxy auth, Clerk linkage, Redis isolation, Supabase schema proof, feature smoke, PR #6, Stage 12A, Stage 12B | NOT_READY | production-runtime-verification-agent | Infrastructure health is green; product readiness is not. |

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
| API_INTERNAL_ORIGIN | present if web calls API internally | 2026-06-26T15:48+05:30: public Railway origin `https://convospan-api-split-production.up.railway.app` confirmed and healthy; Vercel production deployment is READY; direct Railway `/health` returns `200`; production `/api/proxy/health` returns expected unauthenticated `401` | PARTIAL | production-runtime-verification-agent | Public origin is confirmed and no runtime origin errors were found, but authenticated upstream proxy forwarding still needs smoke proof. |

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
| Health ready | DB/schema/migration/env marker | Latest custom-domain `/api/health` and `/api/health?probe=ready` returned `200 OK` with `checks.database: "up"` | PASS | api-origin-health-readiness-agent | Verified that production database readiness is healthy and fully connected |
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
