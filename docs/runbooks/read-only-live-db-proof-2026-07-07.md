# Read-only Live DB Proof Runbook

## Status
Proof design only.
No database accessed in this PR.
No SQL executed in this PR.
No secrets accessed in this PR.
No schema, migration, app, package, workflow, env, or scanner allowlist changes.
Production readiness remains NOT_READY.
DB/migration governance remains RED / NEEDS_REPLAN.

## Purpose
This runbook defines the safe process for proving actual live DB shape before canonical `packages/db` migration adoption, EdgeNode resolution, PR #6 reconsideration, or any production migration proposal.

## Scope
The proof must establish:
- database connection target is the intended environment
- connected role is read-only
- Prisma migrations table state
- existence and shape of `User`
- existence and shape of `UserInvitation`
- existence and shape of `invite_requests`, if present
- existence and shape of `ConnectedMailbox`
- existence and shape of `EdgeNode`
- EdgeNode row count and safe data-handling status
- whether destructive EdgeNode `DELETE` would affect data
- whether live DB shape matches assumptions in Prisma schemas and migration inventory

## Non-goals
- no writes
- no deletes
- no inserts
- no updates
- no DDL
- no migrations
- no seeding
- no schema changes
- no production readiness claim
- no printing secrets
- no customer or user PII dumps
- no OAuth, token, or mailbox secret exposure

## Access requirements
- Use a database role with read-only privileges only.
- Prefer a dedicated short-lived read-only proof credential.
- Credential must never be committed.
- Credential must never be pasted into GitHub, a PR body, logs, docs, screenshots, or chat.
- All outputs must be redacted before attaching to PR evidence.
- If a read-only credential is unavailable, mark proof `BLOCKED`.

## Allowed SQL policy
Only `SELECT` queries are allowed.

Allowed metadata queries:
- current database name
- current user or role
- current schema
- table existence
- column listing
- index listing
- foreign key listing
- Prisma migrations table listing
- row counts for target tables

Forbidden SQL:
- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`
- `DROP`
- `ALTER`
- `CREATE`
- `GRANT`
- `REVOKE`
- `VACUUM FULL`
- `LOCK TABLE`
- migration commands
- any function or procedure that mutates data
- selecting raw PII, tokens, mailbox credentials, OAuth secrets, message bodies, or sensitive user data

## Approved read-only SQL query set

Important:
Write SQL as templates only.
Do not execute them from this PR.

### 1. Environment and role proof

```sql
SELECT
  current_database() AS current_database,
  current_user AS current_user,
  current_schema() AS current_schema,
  now() AS proof_timestamp,
  version() AS server_version;
```

```sql
SELECT
  grantee,
  table_schema,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = current_user
ORDER BY table_schema, privilege_type;
```

```sql
SELECT
  has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public,
  has_table_privilege(current_user, 'public.\"User\"', 'INSERT, UPDATE, DELETE, TRUNCATE') AS user_table_write_privs
;
```

Use the privilege query only if it is safe and supported in the target environment. If safe privilege verification is unavailable, mark the proof `BLOCKED` instead of guessing.

### 2. Table existence

```sql
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    '_prisma_migrations',
    'User',
    'UserInvitation',
    'invite_requests',
    'ConnectedMailbox',
    'EdgeNode'
  )
ORDER BY table_name;
```

This query intentionally uses exact quoted application table names where the live DB may be case-sensitive.

### 3. Column shape

```sql
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'User',
    'UserInvitation',
    'invite_requests',
    'ConnectedMailbox',
    'EdgeNode'
  )
ORDER BY table_name, ordinal_position;
```

### 4. Indexes

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'User',
    'UserInvitation',
    'invite_requests',
    'ConnectedMailbox',
    'EdgeNode'
  )
ORDER BY tablename, indexname;
```

### 5. Foreign keys

```sql
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS referenced_table_name,
  ccu.column_name AS referenced_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'User',
    'UserInvitation',
    'invite_requests',
    'ConnectedMailbox',
    'EdgeNode'
  )
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
```

### 6. Prisma migration state

```sql
SELECT
  id,
  checksum,
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count
FROM public._prisma_migrations
ORDER BY started_at, migration_name;
```

Do not include migration logs, error payloads, or any column that may capture sensitive runtime details.

### 7. Row counts

```sql
SELECT '_prisma_migrations' AS target, COUNT(*) AS row_count FROM public._prisma_migrations
UNION ALL
SELECT 'User', COUNT(*) FROM public."User"
UNION ALL
SELECT 'UserInvitation', COUNT(*) FROM public."UserInvitation"
UNION ALL
SELECT 'invite_requests', COUNT(*) FROM public.invite_requests
UNION ALL
SELECT 'ConnectedMailbox', COUNT(*) FROM public."ConnectedMailbox"
UNION ALL
SELECT 'EdgeNode', COUNT(*) FROM public."EdgeNode";
```

If a target table is absent, do not improvise with dynamic SQL in the same proof step. Record the missing table from the table-existence step and mark the relevant section `FAIL` or `BLOCKED`.

### 8. EdgeNode impact proof

Use `COUNT(*)` only.

```sql
SELECT COUNT(*) AS edge_node_total_rows
FROM public."EdgeNode";
```

If safe and if the columns exist and are non-sensitive:

```sql
SELECT
  status,
  COUNT(*) AS row_count
FROM public."EdgeNode"
GROUP BY status
ORDER BY status;
```

```sql
SELECT
  attestationStatus,
  COUNT(*) AS row_count
FROM public."EdgeNode"
GROUP BY attestationStatus
ORDER BY attestationStatus;
```

Do not select raw node payloads, secrets, configs, URLs, credentials, tokens, or serialized JSON.

### 9. ConnectedMailbox shape proof

Use column listing and count only.

```sql
SELECT COUNT(*) AS connected_mailbox_total_rows
FROM public."ConnectedMailbox";
```

Do not select access tokens, refresh tokens, email contents, mailbox addresses, OAuth scopes where they expose sensitive user data, or provider secrets.

## Redaction rules
- Replace DB host with `REDACTED_HOST`.
- Replace database name with `REDACTED_DB` if the name is sensitive.
- Replace usernames or roles with `REDACTED_ROLE` if the role name is sensitive.
- Never include passwords, connection strings, tokens, auth headers, cookies, JWTs, API keys, OAuth values, mailbox tokens, or raw user rows.
- Only aggregate counts and schema metadata are allowed.
- Any accidental sensitive output must be discarded and not committed.

## PASS / FAIL / BLOCKED criteria

PASS requires:
- read-only role confirmed
- target environment confirmed
- target tables checked
- Prisma migration state checked
- `User`, `UserInvitation`, and `invite_requests` checked
- `ConnectedMailbox` checked without sensitive data exposure
- `EdgeNode` checked without sensitive data exposure
- EdgeNode data impact classified
- no writes performed
- evidence template completed and reviewed

FAIL if:
- role has write privileges beyond approved read-only posture
- target DB is not confirmed
- required table shape conflicts with migration assumptions
- EdgeNode contains data that would be affected by destructive `DELETE` and no preservation plan exists
- `ConnectedMailbox` shape conflicts with PR #6 assumptions
- Prisma migration state conflicts with canonical cutover assumptions

BLOCKED if:
- no approved read-only credential or path exists
- connection target cannot be verified safely
- queries cannot be run without exposing secrets or PII
- database owner does not approve read-only proof execution
- evidence cannot be safely redacted

## Required proof targets

| Target | Required proof | Why it matters | PASS evidence | Failure impact |
| --- | --- | --- | --- | --- |
| `_prisma_migrations` | table existence, safe migration rows, count, latest state | proves live migration history rather than local assumptions | redacted migration metadata and aggregate count | blocks canonical adoption and staging dry run assumptions |
| `User` | table existence, column shape, indexes, foreign keys, row count | anchors auth and tenant assumptions used by runtime paths | redacted schema metadata and count only | indicates live auth schema mismatch risk |
| `UserInvitation` | table existence, column shape, indexes, foreign keys, row count | proves invite flow objects required by current local schema assumptions | redacted schema metadata and count only | keeps auth and onboarding migration work blocked |
| `invite_requests` | table existence, column shape, indexes, foreign keys, row count | proves mapped invite-request object state tied to web-only history | redacted schema metadata and count only | blocks cutover assumptions and additive repair planning |
| `ConnectedMailbox` | table existence, column shape, indexes, foreign keys, row count | proves mailbox schema assumptions before any PR #6 reconsideration | redacted schema metadata and count only | keeps PR #6 mailbox migration work blocked |
| `EdgeNode` | table existence, column shape, indexes, foreign keys, row count, safe impact classification | governs the known RED destructive history item | redacted schema metadata, aggregate counts, impact classification | blocks destructive-path approval and canonical adoption |

## EdgeNode-specific proof requirements
- EdgeNode `DELETE` remains RED until proof exists.
- Need `EdgeNode` table existence and row count.
- If `EdgeNode` has rows, destructive `DELETE` cannot be approved without a preservation, archive, or migration plan.
- If `EdgeNode` has zero rows, destructive SQL still requires governance review; zero rows does not automatically approve destructive SQL.
- Hash-verified historical migration remains evidence only, not approval.

## ConnectedMailbox / PR #6 proof requirements
- PR #6 remains blocked.
- `ConnectedMailbox` table existence and column shape must be proven.
- No token or mailbox contents may be selected.
- Any Gmail or mailbox migration must be separated from app code and routed through the canonical `packages/db` path after cutover.

## Relationship to canonical migration adoption
This proof is required before:
- EdgeNode non-destructive replacement implementation
- any quarantine metadata PR that depends on live DB state
- canonical `packages/db` migration adoption
- scanner blocking mode
- PR #6 migration reconsideration
- staging dry run
- production migration proposal

## Evidence handling workflow
1. Obtain approved read-only DB proof path.
2. Confirm role and target environment.
3. Run only approved `SELECT` queries.
4. Redact output immediately.
5. Fill evidence template.
6. Attach evidence in a future PR or secure internal record.
7. Mark verdict `PASS`, `FAIL`, or `BLOCKED`.
8. Do not commit secrets or raw sensitive outputs.

## Not included
- no DB access in this PR
- no SQL execution in this PR
- no schema edits
- no migration edits
- no migration execution
- no app code edits
- no package edits
- no workflow edits
- no env edits
- no scanner allowlist edits
- no production readiness claim

## Verdict
Read-only live DB proof remains NOT_RUN / PENDING.
DB/migration governance remains RED / NEEDS_REPLAN.
Production readiness remains NOT_READY.
