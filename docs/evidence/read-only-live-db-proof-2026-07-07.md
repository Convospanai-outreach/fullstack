# Read-only Live DB Proof Evidence

## Evidence status
- Status: FAIL
- Environment: production
- Proof date: 2026-07-07
- Proof executor: manual connector evidence outside Codex
- Reviewer: pending
- Read-only path approved by: SELECT-only metadata proof
- Raw secrets included: NO
- Raw PII included: NO
- Write operations performed: NO

## Safety confirmation
- [x] Credential was read-only
- [x] No connection string committed
- [x] No secrets printed
- [x] No raw user rows selected
- [x] No token or mailbox secret columns selected
- [x] Only approved SELECT queries were used
- [x] Output was redacted before sharing

## Environment proof
- current_database: REDACTED_DB
- current_user: REDACTED_ROLE
- current_schema: public
- server_version: PostgreSQL 17.6
- proof timestamp: 2026-07-07
- environment confidence: high
- notes:
  - Supabase project status: ACTIVE_HEALTHY
  - Supabase schemas visible: auth, realtime, storage, vault
  - Vercel project: fullstack-web-xkxn
  - Vercel production deployment: READY
  - Domains: craftmyfunnel.live, www.craftmyfunnel.live
  - No raw project ref recorded; use REDACTED_PROJECT_REF in external records

## Table existence evidence

| Target | Exists? | Schema | Notes |
| --- | --- | --- | --- |
| `_prisma_migrations` | No | public | Missing from public schema |
| `User` | No | public | Missing from public schema |
| `UserInvitation` | No | public | Missing from public schema |
| `invite_requests` | No | public | Missing from public schema |
| `ConnectedMailbox` | No | public | Missing from public schema |
| `EdgeNode` | No | public | Missing from public schema |

## Non-public schema note
- `auth.users` is present and Supabase-managed.
- `auth.users` is not equivalent to public."User".
- public base tables: none.

## Column shape evidence

Public column metadata was not available because the expected tables are missing from the public schema.

### User

```text
MISSING / no public column metadata returned
```

### UserInvitation

```text
MISSING / no public column metadata returned
```

### invite_requests

```text
MISSING / no public column metadata returned
```

### ConnectedMailbox

```text
MISSING / no public column metadata returned
```

### EdgeNode

```text
MISSING / no public column metadata returned
```

## Index and foreign key evidence

Public index and foreign key metadata was not available because the expected tables are missing from the public schema.

### User

```text
MISSING / no public index or foreign key metadata returned
```

### UserInvitation

```text
MISSING / no public index or foreign key metadata returned
```

### invite_requests

```text
MISSING / no public index or foreign key metadata returned
```

### ConnectedMailbox

```text
MISSING / no public index or foreign key metadata returned
```

### EdgeNode

```text
MISSING / no public index or foreign key metadata returned
```

## Prisma migration state evidence

- `_prisma_migrations`: MISSING
- Migration metadata: unavailable because `public._prisma_migrations` does not exist

```text
MISSING / no public migration metadata returned
```

## Row count evidence

| Target | Count | Sensitive? | Notes |
| --- | ---: | --- | --- |
| `_prisma_migrations` | BLOCKED_FOR_COUNT | no | relation `public._prisma_migrations` does not exist |
| `User` | BLOCKED_FOR_COUNT | no | relation `public."User"` does not exist |
| `UserInvitation` | BLOCKED_FOR_COUNT | no | relation `public."UserInvitation"` does not exist |
| `invite_requests` | BLOCKED_FOR_COUNT | no | relation `public.invite_requests` does not exist |
| `ConnectedMailbox` | BLOCKED_FOR_COUNT | no | relation `public."ConnectedMailbox"` does not exist |
| `EdgeNode` | BLOCKED_FOR_COUNT | no | relation `public."EdgeNode"` does not exist |

## EdgeNode impact classification

Classification: `EDGE_NODE_TABLE_MISSING`

Notes:
- Destructive DELETE remains RED unless separately resolved.
- Zero rows does not automatically approve destructive SQL.

## ConnectedMailbox / PR #6 classification

Classification: `CONNECTED_MAILBOX_TABLE_MISSING`

Notes:
- Do not include mailbox tokens, email content, OAuth secrets, or user-level mailbox data.

## Overall verdict

- Status: FAIL
- Reason: the connected Supabase production DB is healthy, but expected Prisma/app public tables and `public._prisma_migrations` are missing from the public schema.
- Next required action: create a migration application plan and staging dry-run plan before any schema creation or production migration.

## Verdict consistency rule

PASS is valid only when Evidence status is PASS and all required proof sections are completed.

If Evidence status is NOT_RUN, the Overall verdict must remain NOT_RUN or BLOCKED.

If any required proof target is missing, unverified, or unsafe to disclose, the Overall verdict must be FAIL or BLOCKED, not PASS.

PASS requires completed approved read-only execution, completed safety checklist, target environment confirmation, target table checks, migration state checks, EdgeNode proof, ConnectedMailbox proof, and reviewer sign-off.

## Reviewer sign-off
- Reviewer: pending
- Date: 2026-07-07
- Approved for next phase? no
- Next phase allowed: migration application plan and staging dry-run planning
- Conditions: no schema creation or production migration until public schema gaps are resolved and re-proved
