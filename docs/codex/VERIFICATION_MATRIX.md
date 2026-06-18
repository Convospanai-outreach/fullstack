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
| Production branch | main or documented release branch | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Latest deployment commit | should match intended release | Latest inspected deployment was `READY` from `codex/db-linkage-swarm-orchestration` commit `12174245a1af55d32c0b46a04b5d9f7b0a2948cd`; recent production deployment from `main` commit `86e918c35f9c2c4b1c7a6265564f26bead62e25c` | RUNTIME_RISK | vercel-linkage-agent | Vercel READY is not launch readiness |
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
| Lead.embedding | Must match canonical schema | Live column is nullable `text`; `apps/web` schema uses `Unsupported("vector(1536)")?`; `apps/api` schema uses `String?` | SCHEMA_DRIFT | supabase-inspector | Canonical type unresolved; see `docs/audits/prisma-canonical-schema-decision.md` |
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
| Lead.embedding | `Unsupported("vector(1536)")?` | `String?` | Live nullable `text` | PR #6 expectation unresolved | SCHEMA_DRIFT | Choose canonical vector/text type before generating any migration |
| ConnectedMailbox | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| Email | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| EmailEvent / EmailActivityLog | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| TrackedLink / EmailTrackedLink | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| SuppressionEntry | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| WaitlistRequest | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| UserInvitation | Present in web schema/migration | Missing from API migration history | Missing live | PR #6 broad auth/mailbox work overlaps | SCHEMA_DRIFT | Add through canonical migration only after auth strategy confirmed |

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
| Read-only schema verifier | Verify migrations, required auth objects, `Lead.embedding`, and schema fingerprint without mutation | `apps/web/src/scripts/verify-schema-readiness.ts` added; package script `schema:verify:readonly` added; not run against production | PASS | orchestrator | Non-mutating evidence tool only; not a CI blocker yet |

## CI gate matrix

| Gate | Expected | Actual | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Prisma validate web | CI enforced | `ci.yml`, `production-gate.yml`, and `web-prisma-migrate.yml` include Prisma validation/generate/migrate paths | PASS | ci-gate-agent | Live Actions status not checked |
| Prisma validate API | CI enforced | `ci.yml` API job generates Prisma and runs migrate deploy | PASS | ci-gate-agent | Live Actions status not checked |
| Schema drift check | CI enforced | No production schema fingerprint/live drift gate found | MISSING | ci-gate-agent | Add gate before launch |
| Read-only schema verifier script | Available but not blocking CI yet | `npm run schema:verify:readonly` available at root/web workspace | PASS | ci-gate-agent | Per REPLAN, do not make blocking until expected values and env targets are approved |
| Migration drift check | CI enforced against disposable DB | CI uses disposable Postgres and `prisma migrate deploy` | PASS | ci-gate-agent | Does not prove live Supabase is current |
| Typecheck | CI enforced | Web/API typecheck jobs present | PASS | ci-gate-agent | Live Actions status not checked |
| Lint | CI enforced | Web lint present | PASS | ci-gate-agent | API lint not confirmed |
| Tests | CI enforced | Web unit/coverage and API tests/coverage present | PASS | ci-gate-agent | Live Actions status not checked |
| Production build | CI enforced | Web build and Vercel parity build present | PASS | ci-gate-agent | Live Actions status not checked |
