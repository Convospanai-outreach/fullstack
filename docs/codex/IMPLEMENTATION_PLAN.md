# CraftMyFunnel DB Linkage Swarm Implementation Plan

Purpose: give Codex in Antigravity IDE a staged, resumable, low-confusion plan to fix Vercel, Supabase, Prisma, DB/auth/cache, migration, and PR-driven schema drift issues.

This plan must be executed with the loop:

```text
PLAN -> CHECK -> ACT -> REPLAN
```

Do not skip CHECK. Do not combine unrelated stages. Every stage must produce evidence and update the workflow state before continuing.

## Mission

Make CraftMyFunnel production-ready by proving and fixing the complete linkage chain:

```text
GitHub repo -> Vercel project -> runtime env -> Supabase DB -> Prisma schema -> migrations -> app runtime -> Clerk user/team -> Redis/cache/queue -> health/smoke/CI gates
```

## Known live targets

| Target | Value |
| --- | --- |
| GitHub repo | `Convospanai-outreach/fullstack` |
| Vercel team | `team_ju8AaZfJ8hE4jmsMW0tTnAJ5` |
| Vercel project | `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` |
| Vercel project name | `fullstack-web-xkxn` |
| Supabase project name | `Fullstack2026` |
| Supabase project ref | `izqcycslipmbgdwgajvu` |
| Supabase direct DB host | `db.izqcycslipmbgdwgajvu.supabase.co` |
| App | CraftMyFunnel |
| Likely Vercel root | `apps/web` |

## Hard safety rules

1. Do not work on `main` directly.
2. Do not merge PR #6 as-is.
3. Do not run destructive production migrations.
4. Do not use `prisma db push` against production.
5. Do not drop or rename production columns/tables without an expand-contract plan.
6. Do not print or commit secret values.
7. Do not assume Vercel `READY` means DB is correct.
8. Do not assume `SELECT 1` means schema is correct.
9. Do not continue after a failed check without updating `WORKFLOW_STATE.md`.
10. Every stage must end with either `READY_FOR_NEXT_STAGE`, `BLOCKED`, or `NEEDS_REPLAN`.

## Required working files

Codex must maintain these files during the work:

| File | Purpose |
| --- | --- |
| `docs/codex/WORKFLOW_STATE.md` | Current stage, status, findings, blockers, next command |
| `docs/codex/VERIFICATION_MATRIX.md` | Expected vs actual Vercel/Supabase/Prisma evidence |
| `docs/audits/db-linkage-fix-log.md` | Chronological change log and decisions |
| `docs/audits/vercel-supabase-reassessment.md` | Vercel and Supabase linkage evidence |
| `docs/audits/prisma-schema-drift-matrix.md` | Web schema vs API schema vs actual DB vs PR #6 |
| `docs/runbooks/database-production-runbook.md` | Migration and rollback process |
| `docs/runbooks/vercel-supabase-smoke-runbook.md` | Smoke test process |

## Agent execution model

Use the agents defined in `docs/codex/AGENTS.md`.

Recommended order:

1. `orchestrator`
2. `repo-cartographer`
3. `vercel-linkage-agent`
4. `supabase-inspector`
5. `prisma-drift-agent`
6. `migration-safety-agent`
7. `runtime-db-agent`
8. `auth-tenant-agent`
9. `redis-cache-agent`
10. `health-smoke-agent`
11. `ci-gate-agent`
12. `pr-strategy-agent`
13. `release-readiness-agent`

Agents may run in parallel only if they do not edit the same files. When in doubt, serialize.

## Global stage gates

Before moving from one stage to the next, the orchestrator must verify:

- `WORKFLOW_STATE.md` is updated.
- `VERIFICATION_MATRIX.md` has new evidence or a reason why no evidence was available.
- All changes are committed or intentionally left uncommitted with explanation.
- No secret values were added.
- No failing check is ignored.
- Next stage is explicitly named.

---

# Stage 0: Branch and baseline

## PLAN

Create or confirm a safe working branch for the fix.

## CHECK

Run or confirm:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
```

## ACT

Use branch:

```text
codex/vercel-supabase-db-linkage-fix
```

If another branch is already being used for this task, record it in `WORKFLOW_STATE.md`.

Create initial files if missing:

```text
docs/audits/db-linkage-fix-log.md
docs/audits/vercel-supabase-reassessment.md
docs/audits/prisma-schema-drift-matrix.md
docs/runbooks/database-production-runbook.md
docs/runbooks/vercel-supabase-smoke-runbook.md
```

## REPLAN

Move to Stage 1 only after branch and baseline commit are recorded.

---

# Stage 1: Repo cartography

## PLAN

Map all DB, auth, cache, deployment, and Prisma ownership files.

## CHECK

Find:

- package scripts in root, `apps/web`, and `apps/api`
- Prisma schemas
- Prisma migrations
- DB client factories
- health endpoints
- Clerk/NextAuth routes
- invite/user/team sync logic
- Redis/cache/queue code
- Vercel/Netlify/GitHub Actions configs
- env examples and parity docs

Suggested commands:

```bash
find . -maxdepth 4 -iname 'package.json' -o -iname 'schema.prisma' -o -iname '.env.example' -o -iname 'vercel.json' -o -iname 'netlify.toml'
grep -R "DATABASE_URL\|DIRECT_URL\|REDIS_URL\|CLERK_\|NEXTAUTH_\|PRISMA_CLIENT_ENGINE_TYPE" -n . --exclude-dir=node_modules --exclude-dir=.git
find apps -path '*prisma/migrations*' -type f | sort
```

## ACT

Update:

```text
docs/audits/vercel-supabase-reassessment.md
```

Include a table:

```text
File | Purpose | Owner | Linkage risk | Needs change? | Evidence
```

## REPLAN

If any DB owner is unclear, mark `NEEDS_REPLAN` and prioritize schema ownership in Stage 4.

---

# Stage 2: Vercel linkage inspection

## PLAN

Confirm the actual Vercel project root, deployment, linked repo, branch, commands, and env variable presence.

## CHECK

Using Vercel tooling, collect without exposing secrets:

- team ID
- project ID
- project name
- root directory
- framework
- build command
- install command
- output directory
- linked Git repo
- production branch
- latest production deployment URL
- latest production deployment commit SHA
- env variable names by environment

For env vars, record only safe fingerprints:

- present/missing
- host only for URLs
- whether Supabase ref `izqcycslipmbgdwgajvu` appears
- whether runtime DB URL is pooler or direct
- whether migration URL is direct
- whether Redis host appears prod/staging/preview
- whether Clerk vars exist
- whether `API_INTERNAL_ORIGIN` exists
- whether `NEXTAUTH_URL` matches deployed domain

## ACT

Update:

```text
docs/audits/vercel-supabase-reassessment.md
docs/codex/VERIFICATION_MATRIX.md
```

Classify findings:

```text
MISSING
WRONG_LINKAGE
AMBIGUOUS
PREVIEW_WRITES_TO_PROD_RISK
BUILD_ONLY_READY_RISK
```

## REPLAN

If Vercel env access is unavailable, create a manual checklist and mark the stage `BLOCKED_EXTERNAL_ACCESS`, but continue with repo-side fixes.

---

# Stage 3: Supabase live schema inspection

## PLAN

Run read-only SQL against Supabase project `izqcycslipmbgdwgajvu`.

## CHECK

Run these read-only queries:

```sql
select current_database() as database_name, current_schema() as schema_name;

select extname, extversion
from pg_extension
where extname in ('vector', 'pgcrypto', 'uuid-ossp')
order by extname;

select table_name
from information_schema.tables
where table_schema = 'public'
and table_name in (
  '_prisma_migrations',
  'Lead',
  'Email',
  'ConnectedMailbox',
  'EmailEvent',
  'TrackedLink',
  'EmailTrackedLink',
  'EmailActivityLog',
  'SuppressionEntry',
  'WaitlistRequest',
  'MailboxHealthSnapshot',
  'MailboxSyncCursor',
  'CampaignSequence',
  'SequenceStep',
  'SequenceEnrollment',
  'SequenceStepRun',
  'LeadChannelStatus',
  'LeadActivity',
  'User',
  'Team',
  'TeamMember',
  'UserInvitation',
  'FeatureFlag',
  'SystemEvent'
)
order by table_name;

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'ConnectedMailbox'
order by ordinal_position;

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'Email'
order by ordinal_position;

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'Lead'
and column_name = 'embedding';

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'SuppressionEntry'
order by ordinal_position;

select migration_name, started_at, finished_at, rolled_back_at
from public._prisma_migrations
order by started_at desc nulls last, finished_at desc nulls last
limit 50;

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
and tablename in (
  'User',
  'Team',
  'TeamMember',
  'Lead',
  'Email',
  'ConnectedMailbox',
  'EmailEvent',
  'TrackedLink',
  'SuppressionEntry'
)
order by tablename, policyname;
```

## ACT

Update:

```text
docs/audits/vercel-supabase-reassessment.md
docs/audits/prisma-schema-drift-matrix.md
docs/codex/VERIFICATION_MATRIX.md
```

## REPLAN

Do not write migrations until the four-way matrix exists:

```text
Expected by apps/web schema | Expected by apps/api schema | Actual Supabase | Expected by PR #6 | Verdict | Fix strategy
```

---

# Stage 4: Prisma ownership and drift resolution plan

## PLAN

Decide whether web and API share one DB or have separate DBs.

## CHECK

Compare:

- `apps/web/prisma/schema.prisma`
- `apps/api/prisma/schema.prisma`
- actual Supabase schema
- PR #6 schema/migration expectations

Focus on:

- `Lead.embedding`
- `ConnectedMailbox`
- `Email`
- `EmailEvent`
- `TrackedLink`
- `SuppressionEntry`
- `WaitlistRequest`
- `User`
- `TeamMember`
- `UserInvitation`

## ACT

If shared DB:

- establish a canonical schema contract
- make web/API schemas identical for shared tables or generate one from the other
- add `db:schema:check`
- add a schema drift script

If separate DBs:

- explicitly rename/env-scope URLs
- add hard runtime guards
- document ownership

## REPLAN

Proceed only after schema ownership is explicit.

---

# Stage 5: Gmail and mailbox schema conflict resolution

## PLAN

Resolve duplicate and incompatible Gmail/mailbox/tracking concepts.

## CHECK

Find all references to:

```text
ConnectedMailbox.email
ConnectedMailbox.emailAddress
encryptedAccessToken
accessTokenEncrypted
encryptedRefreshToken
refreshTokenEncrypted
tokenExpiresAt
expiresAt
historyId
gmailHistoryId
EmailEvent
EmailActivityLog
TrackedLink
EmailTrackedLink
SuppressionEntry
WaitlistRequest
```

## ACT

Choose final model names and fields.

Default preference:

- use current main schema if actual Supabase matches it
- adapt PR #6 code to final schema
- do not create duplicate event/link tables unless product reason is documented
- remove unsafe `CREATE TABLE IF NOT EXISTS` patterns for conflicting table shapes
- use expand-contract migrations for legacy/PR columns

## REPLAN

Update matrix and run Prisma validation before moving on.

---

# Stage 6: Migration safety and verification scripts

## PLAN

Add migration verification and drift checks.

## CHECK

Inspect all migrations and `_prisma_migrations` state.

## ACT

Add scripts:

```text
scripts/db/verify-schema.ts
scripts/db/verify-migrations.ts
scripts/db/fingerprint-schema.ts
scripts/db/check-env-linkage.ts
```

Add package scripts:

```text
db:verify
db:migrate:status
db:migrate:deploy
db:drift:check
db:schema:fingerprint
```

Rules:

- runtime uses `DATABASE_URL`
- migration deploy/status uses `DIRECT_URL`
- production refuses pooler for migrations
- preview refuses production DB unless explicitly allowed
- output redacts secrets

## REPLAN

Do not apply production migrations yet. First prove scripts work on local or staging.

---

# Stage 7: Prisma engine and runtime alignment

## PLAN

Resolve Prisma engine/config mismatch.

## CHECK

Inspect:

- generator `engineType`
- `PRISMA_CLIENT_ENGINE_TYPE` in package scripts
- env examples
- db clients and db factories
- Prisma version and adapter usage

## ACT

Make a single consistent runtime contract across:

- web schema
- API schema
- env examples
- build scripts
- worker scripts
- readiness scripts
- runtime DB clients

Fix unmanaged production `new PrismaClient()` paths.

## REPLAN

Run validation, typecheck, and build.

---

# Stage 8: Env linkage guards

## PLAN

Add env validation and safe diagnostics.

## CHECK

Confirm critical vars and feature-gated vars.

## ACT

Implement env validation for:

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

Add guards for:

- preview using production DB
- preview using production Redis
- missing Clerk vars when Clerk enabled
- missing direct URL for migration commands

## REPLAN

Update smoke runbook.

---

# Stage 9: Health and smoke tests

## PLAN

Replace shallow readiness with layered probes.

## CHECK

Inspect all health endpoints and consumers.

## ACT

Implement:

- `probe=live`: no external IO
- `probe=ready`: DB, schema fingerprint, migrations, required tables/columns, app environment marker
- `probe=deep`: protected by secret; Clerk config, Redis ping, API origin, queue namespace, no secret leakage

Add smoke scripts:

```text
smoke:vercel
smoke:db
smoke:auth
smoke:redis
smoke:deep-health
```

## REPLAN

Do not call production deep health without a protected secret.

---

# Stage 10: Clerk/app DB linkage

## PLAN

Ensure Clerk login proves app DB user/team readiness.

## CHECK

Inspect user sync, invite gating, webhook idempotency, and team membership.

## ACT

Add readiness seed/smoke path that verifies:

- Clerk user identity
- app `User` row
- `clerkUserId`
- approved invite if invite-gated
- `TeamMember`
- role/tenant access

## REPLAN

Run auth tests and update runbook.

---

# Stage 11: Redis/cache/queue isolation

## PLAN

Verify Redis and queue environment isolation.

## CHECK

Find all Redis, queue, worker, rate limiter, and cache usage.

## ACT

Add:

- Redis env fingerprint check
- key namespace by app/env/team
- queue namespace by app/env
- deep health Redis ping
- fail-closed for critical queue/rate-limit paths

## REPLAN

If Redis is absent, ensure feature flags disable Redis-dependent features or health reports degraded intentionally.

---

# Stage 12: CI and PR strategy

## PLAN

Prevent recurrence and split risky PR work.

## CHECK

Inspect GitHub Actions and open PRs.

## ACT

- cherry-pick/merge PR #2 only if still clean and tested
- do not merge PR #6 as-is
- split PR #6 into smaller branches:
  1. Prisma/env/runtime alignment
  2. safe migrations
  3. Gmail mailbox service
  4. tracking/unsubscribe/waitlist routes
  5. tests/docs/ops

Add CI gates:

- Prisma validate web/API
- Prisma generate web/API
- schema drift check
- migration drift check
- typecheck
- lint
- tests
- web production build

## REPLAN

Continue only after CI gates run locally or are documented as pending external CI.

---

# Stage 13: Final readiness

## PLAN

Produce final evidence and release path.

## CHECK

Run all available checks:

```bash
npm run db:schema:check
npm run db:verify
npm run typecheck
npm run lint
npm run test
npm run build
```

Also run smoke checks where env allows.

## ACT

Create:

```text
docs/audits/production-readiness-final.md
```

Include:

- issues found
- fixes made
- migrations added
- Vercel env expectations
- Supabase schema expectations
- Redis expectations
- Clerk expectations
- test outputs
- remaining risks
- rollback notes

## REPLAN

If blockers remain, do not mark complete. Write the next action plan.

## Final definition of done

- Vercel env linkage verified by safe fingerprints.
- Supabase actual schema matches canonical Prisma schema.
- Web/API Prisma ownership is explicit and drift-gated.
- ConnectedMailbox conflict resolved.
- EmailEvent/EmailActivityLog and TrackedLink/EmailTrackedLink duplication resolved.
- Prisma engine/runtime config consistent.
- Migrations are safe and DIRECT_URL-based.
- Health checks verify schema/migrations/project, not just `SELECT 1`.
- Clerk session to app DB user/team smoke implemented.
- Redis/cache/queue environment isolation implemented.
- Preview cannot write production DB/cache unless explicitly allowed.
- CI blocks future DB/schema drift.
- Runbooks exist.
- PR #6 is split or blocked, not blindly merged.
- Final PR ready for review.
