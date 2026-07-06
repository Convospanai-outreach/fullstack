# Destructive Migration Scanner and Read-only Audit Hardening

## 1. Problem observed

The current repo already carries a known RED migration-governance finding:

- `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql`
- `apps/api/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql`

Both files contain `DELETE FROM "EdgeNode"` in committed migration history.

The read-only drift proof also showed:

- local Prisma schemas are aligned
- migration histories remain divergent
- `schema:verify:readonly` is blocked without a safe DB URL
- `readiness:audit --workspace apps/api` is not safe for production evidence because it seeds before auditing

## 2. Safety goals

- Detect destructive Prisma migration SQL before merge.
- Fail closed in local and explicit tooling usage.
- Keep CI advisory until the current known RED migration path is quarantined or replaced.
- Avoid DB connections, env reads, or any mutation.
- Keep full production readiness marked `NOT_READY`.

## 3. Scanner behavior

This PR adds `scripts/readiness/scan-destructive-migrations.ts`.

The scanner:

- scans tracked Prisma migration SQL files under:
  - `apps/web/prisma/migrations/**/migration.sql`
  - `apps/api/prisma/migrations/**/migration.sql`
  - `packages/db/prisma/migrations/**/migration.sql`
- uses `git ls-files` so the scan follows tracked repository content
- detects destructive SQL patterns
- prints:
  - file path
  - line number
  - matched pattern
  - excerpt
  - severity
- exits non-zero when unallowlisted destructive findings are present
- supports an optional explicit allowlist file path, but no allowlist is introduced in this PR

## 4. Destructive SQL patterns detected

At minimum, the scanner looks for:

- `DELETE FROM`
- `TRUNCATE`
- `DROP TABLE`
- `DROP COLUMN`
- `DROP INDEX`
- `DROP CONSTRAINT`
- `ALTER TABLE ... DROP`

Severity is intentionally conservative:

- `DELETE FROM`, `TRUNCATE`, `DROP TABLE`: critical
- `DROP COLUMN`: high
- `DROP INDEX`, `DROP CONSTRAINT`, `ALTER TABLE ... DROP`: medium

## 5. Current known RED finding: EdgeNode DELETE path

This PR does not hide or downgrade the known `EdgeNode` issue.

Expected scanner outcome on the current repository state:

- detects `DELETE FROM "EdgeNode"` in both:
  - `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql`
  - `apps/api/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql`
- exits non-zero in direct/local use
- keeps DB/migration governance RED

No migration files were edited.

## 6. CI integration strategy

This PR integrates the scanner into `.github/workflows/verify.yml`.

Behavior:

- docs-only PRs keep the PR #74 no-op success path
- non-docs PRs run the destructive migration scan job
- the scan job is lightweight:
  - checkout
  - setup Node
  - run the scanner
- no Docker, Vercel, Railway, Supabase, or DB steps are added

## 7. Advisory vs blocking mode decision

Current mode: advisory

Reason:

- the repo already contains a known destructive migration finding on `main`
- making the scan blocking immediately would deadlock ordinary non-docs PRs before the destructive `EdgeNode` path is quarantined or replaced

Current CI behavior:

- the scanner still reports the RED finding
- the workflow stays green while clearly warning that destructive findings exist

Condition for switching to blocking mode:

1. the committed `EdgeNode` destructive path is quarantined or replaced with a non-destructive approved design
2. canonical migration ownership is selected
3. any approved exceptions have an explicit reviewed allowlist policy
4. the scanner can run with zero unresolved destructive findings on main

## 8. Read-only audit hardening notes

This PR does not rewrite the existing DB verification scripts.

Observed safety boundary:

- `npm run db:schema:compare`
  - read-only and local-file only
- `npm run schema:verify:readonly`
  - intended read-only verifier, but still blocked until a safe DB URL is available
- `npm run readiness:audit --workspace apps/api`
  - not safe for production evidence because `apps/api/package.json` runs `readiness:seed` first
- `apps/api/src/scripts/seed-readiness.ts`
  - performs DB writes through `upsert`, `create`, and `update`

Hardening outcome in this PR:

- the safety distinction is now explicit in repo docs
- no DB behavior changed
- no audit script was run against production

## 9. Commands added

- `npm run migrations:scan:destructive`

Direct local equivalent:

- `node --experimental-strip-types scripts/readiness/scan-destructive-migrations.ts`

## 10. What this PR does not change

- no Prisma schema files were edited
- no migration SQL files were edited
- no migrations were run
- no production DB was touched
- no canonical migration owner was selected operationally
- no read-only DB credential flow was added
- no app runtime behavior was changed

## 11. Remaining follow-up PRs

1. canonical migration ownership decision PR
2. destructive `EdgeNode` remediation design PR
3. read-only verifier input hardening PR
4. no-seed readiness audit mode PR
5. staging dry-run PR
6. production migration execution PR after approvals

## 12. Verification plan

- docs-only PR should skip the scanner through the existing no-op path
- non-docs PR should run the scanner job
- current scanner output should detect the existing `EdgeNode` DELETE path
- CI should stay advisory until the known RED path is remediated
- no migrations were edited
- no migrations were run
- no production DB was touched
- existing RED remains until the destructive migration path is remediated
- full production readiness remains `NOT_READY`
