# Codex Agent Swarm

This file defines the agentic swarm for the CraftMyFunnel Vercel/Supabase/Prisma production-readiness fix.

Each agent must operate with:

```text
PLAN -> CHECK -> ACT -> REPLAN
```

Agents must update:

```text
docs/codex/WORKFLOW_STATE.md
docs/codex/VERIFICATION_MATRIX.md
```

No agent may hide uncertainty. If evidence is missing, mark the stage `BLOCKED` or `NEEDS_REPLAN`.

## Shared output format

Every agent response or working note must use this format:

```markdown
## Agent
<agent-id>

## Stage
<stage number and name>

## PLAN
- ...

## CHECK
- Commands run:
- Files inspected:
- Evidence found:

## ACT
- Files changed:
- Migrations added:
- Scripts added:
- Tests added:

## REPLAN
- Status: READY_FOR_NEXT_STAGE | BLOCKED | NEEDS_REPLAN
- Next agent:
- Next action:
- Risks:
```

## Agent dependency graph

```text
orchestrator
  -> repo-cartographer
  -> vercel-linkage-agent
  -> supabase-inspector
  -> prisma-drift-agent
  -> migration-safety-agent
  -> runtime-db-agent
  -> env-guard-agent
  -> health-smoke-agent
  -> auth-tenant-agent
  -> redis-cache-agent
  -> ci-gate-agent
  -> pr-strategy-agent
  -> release-readiness-agent
```

Parallel-safe groups:

```text
Group A: vercel-linkage-agent, supabase-inspector
Group B: auth-tenant-agent, redis-cache-agent
Group C: ci-gate-agent, release-readiness-agent after implementation is stable
```

Do not run parallel agents if they edit the same files.

---

# 1. orchestrator

## Mission

Coordinate the entire task, enforce stage gates, maintain state, and prevent Codex from drifting or stopping halfway.

## Owns

```text
docs/codex/WORKFLOW_STATE.md
docs/codex/VERIFICATION_MATRIX.md
docs/audits/db-linkage-fix-log.md
```

## Responsibilities

- Read `IMPLEMENTATION_PLAN.md` and this file before starting.
- Select the next agent.
- Verify each agent updates evidence files.
- Block destructive actions until read-only evidence exists.
- Keep work split into small commits.
- Ensure no secrets are committed.
- Ensure every stage ends with clear status.

## Stop conditions

Stop and mark `BLOCKED` if:

- production DB mutation is required but not explicitly approved
- live Supabase evidence is unavailable and a migration decision depends on it
- web/API schema ownership is still unclear
- PR #6 changes cannot be safely separated

---

# 2. repo-cartographer

## Mission

Map all files related to DB, Prisma, Vercel, Supabase, Clerk, Redis, health, CI, and deployment.

## Owns

```text
docs/audits/vercel-supabase-reassessment.md
```

## Checks

Find and classify:

```text
package.json scripts
schema.prisma files
migration folders
db.ts/dbFactory.ts files
health routes
auth routes
Clerk webhook/sync logic
invite/team logic
Redis/cache/queue usage
Vercel/Netlify configs
GitHub Actions
.env.example files
production readiness docs
```

## Output

A table:

```text
File | Purpose | Owner | Risk category | Needs change? | Evidence
```

## Handoff to

`vercel-linkage-agent` and `supabase-inspector`.

---

# 3. vercel-linkage-agent

## Mission

Verify Vercel project configuration and deployment linkage without leaking secrets.

## Owns

```text
docs/audits/vercel-supabase-reassessment.md
docs/codex/VERIFICATION_MATRIX.md
```

## Checks

Collect safe evidence for:

```text
Vercel team
Vercel project
root directory
build command
install command
framework
output directory
linked Git repo
production branch
latest production deployment
latest commit SHA
env var presence by environment
DATABASE_URL host fingerprint
DIRECT_URL host fingerprint
Supabase project ref presence
REDIS_URL presence and host fingerprint
Clerk env presence
NEXTAUTH_URL match
API_INTERNAL_ORIGIN presence
```

## Must not do

- Do not print env values.
- Do not mutate Vercel env vars until the plan is approved.

## Output verdicts

```text
MISSING_ENV
WRONG_LINKAGE
AMBIGUOUS_LINKAGE
PREVIEW_WRITES_TO_PROD_RISK
BUILD_ONLY_READY_RISK
READY
```

## Handoff to

`env-guard-agent` and `health-smoke-agent`.

---

# 4. supabase-inspector

## Mission

Inspect the live Supabase project schema using read-only queries.

## Owns

```text
docs/audits/vercel-supabase-reassessment.md
docs/audits/prisma-schema-drift-matrix.md
docs/codex/VERIFICATION_MATRIX.md
```

## Checks

Run read-only SQL from `IMPLEMENTATION_PLAN.md`, Stage 3.

Must verify:

```text
current DB/schema
installed extensions
critical table presence
ConnectedMailbox columns
Email columns
Lead.embedding actual type
SuppressionEntry columns
latest _prisma_migrations
RLS policies on critical tables
```

## Must not do

- No DDL.
- No `prisma db push`.
- No destructive queries.
- No data export beyond schema metadata.

## Output verdicts

```text
MISSING_TABLE
MISSING_COLUMN
WRONG_COLUMN_TYPE
DUPLICATE_TABLE_CONCEPT
MIGRATION_DRIFT
RLS_GAP
READY
```

## Handoff to

`prisma-drift-agent`.

---

# 5. prisma-drift-agent

## Mission

Resolve web schema vs API schema vs actual DB vs PR #6 drift.

## Owns

```text
docs/audits/prisma-schema-drift-matrix.md
scripts/db/compare-prisma-schemas.ts or equivalent
```

## Checks

Compare:

```text
apps/web/prisma/schema.prisma
apps/api/prisma/schema.prisma
actual Supabase schema
PR #6 schema/migration expectations
```

Focus on:

```text
Lead.embedding
ConnectedMailbox
Email
EmailEvent
TrackedLink
SuppressionEntry
WaitlistRequest
User
TeamMember
UserInvitation
_prisma_migrations
```

## Decisions required

Pick one:

```text
Option A: web and API share one canonical DB schema
Option B: web and API use separate DBs with explicit env ownership
```

Default to Option A unless evidence proves separate DBs.

## Output

Four-way matrix:

```text
Expected by web schema | Expected by API schema | Actual Supabase | PR #6 expectation | Verdict | Fix strategy
```

## Handoff to

`migration-safety-agent` and `runtime-db-agent`.

---

# 6. migration-safety-agent

## Mission

Create safe migration and verification strategy.

## Owns

```text
scripts/db/verify-schema.ts
scripts/db/verify-migrations.ts
scripts/db/fingerprint-schema.ts
scripts/db/check-env-linkage.ts
docs/runbooks/database-production-runbook.md
```

## Checks

Inspect:

```text
all migration folders
_prisma_migrations evidence
latest expected migration
DIRECT_URL usage
DATABASE_URL usage
unsafe CREATE TABLE IF NOT EXISTS migrations
PR #6 migration conflicts
```

## Actions

Add scripts and package commands:

```text
db:verify
db:migrate:status
db:migrate:deploy
db:drift:check
db:schema:fingerprint
```

## Safety rules

- `DIRECT_URL` required for migration commands.
- Migration commands refuse pooler URLs.
- Production destructive actions are blocked.
- Preview-to-production DB usage is blocked unless explicitly allowed.
- All output redacts secrets.

## Handoff to

`ci-gate-agent` and `release-readiness-agent`.

---

# 7. runtime-db-agent

## Mission

Align Prisma engine, adapter, pooling, and runtime DB clients.

## Owns

```text
apps/web/src/lib/db.ts
apps/web/src/lib/dbFactory.ts
apps/api/src/lib/db.ts
apps/api/src/lib/dbFactory.ts
apps/web/.env.example
apps/api/.env.example
package scripts
```

## Checks

Inspect:

```text
Prisma generator engineType
PRISMA_CLIENT_ENGINE_TYPE usage
@prisma/adapter-pg usage
pg pool settings
global Prisma singleton behavior
region DB client fallback behavior
production unmanaged new PrismaClient() calls
```

## Actions

- Choose one Prisma runtime contract.
- Make env docs and package scripts match it.
- Standardize web/API DB clients.
- Remove unmanaged per-request production clients.
- Ensure region fallback is explicit and fail-closed.

## Handoff to

`env-guard-agent`.

---

# 8. env-guard-agent

## Mission

Add robust env validation and safe linkage fingerprints.

## Owns

```text
apps/web/src/lib/env.ts
apps/api/src/lib/env.ts if API active
docs/runbooks/vercel-supabase-smoke-runbook.md
```

## Checks

Validate presence and safe linkage for:

```text
DATABASE_URL
DIRECT_URL
REDIS_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_API_URL
API_INTERNAL_ORIGIN
ENCRYPTION_KEY
CRON_SECRET
APP_ENV
VERCEL_ENV
```

## Actions

Add guards for:

- missing critical envs
- wrong Supabase project ref
- DIRECT_URL pointing to pooler
- preview writing production DB/cache
- missing Clerk when auth is enabled
- Redis-dependent feature enabled without Redis

## Handoff to

`health-smoke-agent`.

---

# 9. health-smoke-agent

## Mission

Replace shallow health checks with layered readiness and smoke checks.

## Owns

```text
apps/web/src/app/api/health/route.ts
apps/api/routes/health/route.ts
smoke scripts
docs/runbooks/vercel-supabase-smoke-runbook.md
```

## Checks

Inspect all current health endpoints and monitoring consumers.

## Actions

Implement:

```text
probe=live
probe=ready
probe=deep
```

Readiness must verify:

- DB connection
- schema fingerprint
- required tables/columns
- expected migration presence
- app environment marker

Deep health must verify:

- Clerk config presence
- Redis ping when required
- API origin linkage
- queue namespace
- no secret leakage

## Handoff to

`auth-tenant-agent` and `redis-cache-agent`.

---

# 10. auth-tenant-agent

## Mission

Ensure Clerk authentication links to app DB user, invite, team, and role.

## Owns

```text
Clerk webhook route
findOrCreateClerkAppUser logic
invite/user/team sync logic
auth smoke tests
```

## Checks

Verify:

```text
Clerk user ID stored in app User
UserInvitation behavior
TeamMember creation or validation
role/tenant access
webhook idempotency
missing-user behavior
```

## Actions

Add or fix smoke path proving:

```text
Clerk session -> app User -> TeamMember -> dashboard/API access
```

## Handoff to

`health-smoke-agent` and `ci-gate-agent`.

---

# 11. redis-cache-agent

## Mission

Verify Redis/cache/queue isolation and readiness.

## Owns

```text
Redis client files
queue workers
cache helpers
rate limiters
smoke redis scripts
```

## Checks

Find all usage of:

```text
REDIS_URL
Upstash envs
ioredis
redis package
queue names
rate limit keys
cache prefixes
worker consumers
```

## Actions

Add:

- Redis safe fingerprint check
- key namespace by app/env/team
- queue namespace by app/env
- fail-closed behavior for critical queues/rate limits
- graceful degradation for non-critical cache

## Handoff to

`health-smoke-agent` and `ci-gate-agent`.

---

# 12. ci-gate-agent

## Mission

Prevent future DB/schema/runtime drift through CI.

## Owns

```text
.github/workflows/*
package scripts
PR template if present
```

## Checks

Inspect existing CI and package scripts.

## Actions

Add or update CI to run:

```text
install
lint
typecheck
prisma validate web
prisma validate api
prisma generate web
prisma generate api
db:schema:check
migration drift check on disposable Postgres
unit tests
integration tests where available
web production build
```

Add PR checklist for DB/env/schema changes.

## Handoff to

`pr-strategy-agent` and `release-readiness-agent`.

---

# 13. pr-strategy-agent

## Mission

Handle PR #2 and PR #6 safely.

## Owns

```text
docs/audits/pr6-split-plan.md if needed
```

## Checks

Inspect PR #2 and PR #6.

## Actions

- Apply PR #2 only if still applicable and tests pass.
- Do not merge PR #6 as-is.
- Split PR #6 into small branches:
  1. Prisma/env/runtime alignment
  2. safe DB migrations
  3. Gmail mailbox service
  4. tracking/unsubscribe/waitlist routes
  5. tests/docs/ops

## Handoff to

`release-readiness-agent`.

---

# 14. release-readiness-agent

## Mission

Prepare final production readiness report and PR summary.

## Owns

```text
docs/audits/production-readiness-final.md
```

## Checks

Run all available checks:

```text
db:schema:check
db:verify
typecheck
lint
test
build
smoke checks where env allows
```

## Actions

Write final report with:

- issues found
- fixes made
- migrations added
- Vercel expectations
- Supabase expectations
- Redis expectations
- Clerk expectations
- test outputs
- remaining risks
- rollback notes

## Final status

Use one of:

```text
PRODUCTION_READY
CONTROLLED_BETA_READY
BLOCKED_BY_EXTERNAL_ACCESS
BLOCKED_BY_SCHEMA_CONFLICT
BLOCKED_BY_FAILED_TESTS
```

---

# 15. db-proof-evidence-agent

## Mission

Maintain redacted live DB proof evidence and readiness handoff documentation.

## Owns

```text
docs/evidence/**
docs/codex/WORKFLOW_STATE.md
docs/codex/VERIFICATION_MATRIX.md
```

## Allowed actions

- documentation-only evidence updates

## Hard stop conditions

Stop and mark `BLOCKED` if:

- DB access is required
- SQL execution is required
- secrets or env access is required
- migrations are requested
- seeds are requested
- schema, app, runtime, package, or workflow changes are requested
- a production readiness claim is requested
- a PR #6 unblock is requested

## Next-agent rule

If live DB proof is `BLOCKED`, do not hand off to the next phase until reviewer sign-off explicitly approves it. After sign-off, hand off to `migration-safety-agent` for a docs-only migration application and staging dry-run plan.

No migration execution is authorized.
