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
| Project ID | prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8 | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Project name | fullstack-web-xkxn | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Root directory | apps/web or documented equivalent | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Linked repo | Convospanai-outreach/fullstack | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Production branch | main or documented release branch | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Latest deployment commit | should match intended release | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| DATABASE_URL production | expected Supabase ref izqcycslipmbgdwgajvu; runtime/pooler allowed | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent | host/ref only; no secret |
| DIRECT_URL production | expected direct host db.izqcycslipmbgdwgajvu.supabase.co | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent | host/ref only; no secret |
| Preview DB isolation | preview must not write prod DB unless explicitly allowed | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Redis production | present if cache/queue enabled | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent | host only; no secret |
| Redis preview isolation | preview must not share prod namespace | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |
| Clerk vars | present when Clerk auth enabled | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent | values must be redacted |
| API_INTERNAL_ORIGIN | present if web calls API internally | NOT_CHECKED | NOT_CHECKED | vercel-linkage-agent |  |

## Supabase schema matrix

| Object | Expected by app | Actual Supabase | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| vector extension | Required if Lead.embedding is vector | NOT_CHECKED | NOT_CHECKED | supabase-inspector |  |
| _prisma_migrations | Present and latest expected migration applied | NOT_CHECKED | NOT_CHECKED | supabase-inspector |  |
| Lead.embedding | Must match canonical schema | NOT_CHECKED | NOT_CHECKED | supabase-inspector | Known web/API drift risk |
| Email | Must include final canonical email fields | NOT_CHECKED | NOT_CHECKED | supabase-inspector |  |
| ConnectedMailbox | Must match canonical mailbox model | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 conflict risk |
| EmailEvent | Prefer canonical event table | NOT_CHECKED | NOT_CHECKED | supabase-inspector | Duplicate with EmailActivityLog risk |
| EmailActivityLog | Should not duplicate EmailEvent unless documented | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 risk |
| TrackedLink | Prefer canonical link tracking table | NOT_CHECKED | NOT_CHECKED | supabase-inspector | Duplicate with EmailTrackedLink risk |
| EmailTrackedLink | Should not duplicate TrackedLink unless documented | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 risk |
| SuppressionEntry | Must match final canonical shape | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 shape conflict risk |
| WaitlistRequest | Present only if feature requires it | NOT_CHECKED | NOT_CHECKED | supabase-inspector | PR #6 adds it |
| User | Required for app auth linkage | NOT_CHECKED | NOT_CHECKED | supabase-inspector |  |
| TeamMember | Required for tenant membership | NOT_CHECKED | NOT_CHECKED | supabase-inspector |  |
| UserInvitation | Required if invite gating enabled | NOT_CHECKED | NOT_CHECKED | supabase-inspector |  |

## Four-way Prisma drift matrix

| Model/table | apps/web schema | apps/api schema | Actual Supabase | PR #6 expectation | Verdict | Fix strategy |
| --- | --- | --- | --- | --- | --- | --- |
| Lead.embedding | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| ConnectedMailbox | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| Email | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| EmailEvent / EmailActivityLog | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| TrackedLink / EmailTrackedLink | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| SuppressionEntry | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| WaitlistRequest | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |
| UserInvitation | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |  |

## Runtime linkage matrix

| Runtime concern | Expected | Actual | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Prisma engine config | One consistent strategy across schema/env/scripts | NOT_CHECKED | NOT_CHECKED | runtime-db-agent |  |
| Adapter usage | Consistent adapter-pg/pg pool strategy if chosen | NOT_CHECKED | NOT_CHECKED | runtime-db-agent |  |
| Global Prisma singleton | No unmanaged per-request production clients | NOT_CHECKED | NOT_CHECKED | runtime-db-agent |  |
| Region fallback | Fail closed unless explicitly allowed | NOT_CHECKED | NOT_CHECKED | runtime-db-agent |  |
| Migration URL path | DIRECT_URL only for migrate deploy/status | NOT_CHECKED | NOT_CHECKED | migration-safety-agent |  |
| Runtime URL path | DATABASE_URL for app runtime | NOT_CHECKED | NOT_CHECKED | migration-safety-agent |  |

## Auth/cache/readiness matrix

| Concern | Expected | Actual | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Clerk session to app User | Verified by smoke path | NOT_CHECKED | NOT_CHECKED | auth-tenant-agent |  |
| User to TeamMember | Verified by smoke path | NOT_CHECKED | NOT_CHECKED | auth-tenant-agent |  |
| Invite gating | Clear path for invited users | NOT_CHECKED | NOT_CHECKED | auth-tenant-agent |  |
| Redis ping | Required when Redis features enabled | NOT_CHECKED | NOT_CHECKED | redis-cache-agent |  |
| Redis namespace | Environment-isolated | NOT_CHECKED | NOT_CHECKED | redis-cache-agent |  |
| Health live | No external IO | NOT_CHECKED | NOT_CHECKED | health-smoke-agent |  |
| Health ready | DB/schema/migration/env marker | NOT_CHECKED | NOT_CHECKED | health-smoke-agent |  |
| Health deep | Protected, includes auth/cache/internal checks | NOT_CHECKED | NOT_CHECKED | health-smoke-agent |  |

## CI gate matrix

| Gate | Expected | Actual | Verdict | Owner agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Prisma validate web | CI enforced | NOT_CHECKED | NOT_CHECKED | ci-gate-agent |  |
| Prisma validate API | CI enforced | NOT_CHECKED | NOT_CHECKED | ci-gate-agent |  |
| Schema drift check | CI enforced | NOT_CHECKED | NOT_CHECKED | ci-gate-agent |  |
| Migration drift check | CI enforced against disposable DB | NOT_CHECKED | NOT_CHECKED | ci-gate-agent |  |
| Typecheck | CI enforced | NOT_CHECKED | NOT_CHECKED | ci-gate-agent |  |
| Lint | CI enforced | NOT_CHECKED | NOT_CHECKED | ci-gate-agent |  |
| Tests | CI enforced | NOT_CHECKED | NOT_CHECKED | ci-gate-agent |  |
| Production build | CI enforced | NOT_CHECKED | NOT_CHECKED | ci-gate-agent |  |
