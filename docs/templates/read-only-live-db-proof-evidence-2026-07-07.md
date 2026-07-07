# Read-only Live DB Proof Evidence Template

## Evidence status
- Status: NOT_RUN / PASS / FAIL / BLOCKED
- Environment: production / staging / preview / unknown
- Proof date:
- Proof executor:
- Reviewer:
- Read-only path approved by:
- Raw secrets included: NO
- Raw PII included: NO
- Write operations performed: NO

## Safety confirmation
- [ ] Credential was read-only
- [ ] No connection string committed
- [ ] No secrets printed
- [ ] No raw user rows selected
- [ ] No token or mailbox secret columns selected
- [ ] Only approved SELECT queries were used
- [ ] Output was redacted before sharing

## Environment proof
- current_database: REDACTED_DB or NON_SENSITIVE_ALIAS
- current_user: REDACTED_ROLE or NON_SENSITIVE_ALIAS
- current_schema: public / REDACTED_SCHEMA
- server_version:
- proof timestamp:
- environment confidence: high / medium / low
- notes:

Do not paste raw database names, role names, hosts, project refs, connection strings, usernames, or provider identifiers into PR evidence. Use a non-sensitive alias or `REDACTED_*` placeholder.

## Table existence evidence

| Target | Exists? | Schema | Notes |
| --- | --- | --- | --- |
| `_prisma_migrations` |  |  |  |
| `User` |  |  |  |
| `UserInvitation` |  |  |  |
| `invite_requests` |  |  |  |
| `ConnectedMailbox` |  |  |  |
| `EdgeNode` |  |  |  |

## Column shape evidence

Paste redacted column metadata only.
Do not paste row data.

### User

```text
REDACTED_COLUMN_METADATA
```

### UserInvitation

```text
REDACTED_COLUMN_METADATA
```

### invite_requests

```text
REDACTED_COLUMN_METADATA
```

### ConnectedMailbox

```text
REDACTED_COLUMN_METADATA
```

### EdgeNode

```text
REDACTED_COLUMN_METADATA
```

## Index and foreign key evidence

### User

```text
REDACTED_INDEX_AND_FK_METADATA
```

### UserInvitation

```text
REDACTED_INDEX_AND_FK_METADATA
```

### invite_requests

```text
REDACTED_INDEX_AND_FK_METADATA
```

### ConnectedMailbox

```text
REDACTED_INDEX_AND_FK_METADATA
```

### EdgeNode

```text
REDACTED_INDEX_AND_FK_METADATA
```

## Prisma migration state evidence

Allowed fields only:
- migration_name
- checksum
- started_at
- finished_at
- rolled_back_at
- applied_steps_count

Do not include raw logs if sensitive.

```text
REDACTED_MIGRATION_METADATA
```

## Row count evidence

| Target | Count | Sensitive? | Notes |
| --- | ---: | --- | --- |
| `User` |  | no |  |
| `UserInvitation` |  | no |  |
| `invite_requests` |  | no |  |
| `ConnectedMailbox` |  | no |  |
| `EdgeNode` |  | no |  |

## EdgeNode impact classification

Choose one:
- BLOCKED_NO_PROOF
- EDGE_NODE_TABLE_MISSING
- EDGE_NODE_ZERO_ROWS
- EDGE_NODE_HAS_ROWS_REQUIRES_PRESERVATION_PLAN
- EDGE_NODE_SHAPE_CONFLICT
- EDGE_NODE_PROOF_FAILED

Classification:

Notes:
- Destructive DELETE remains RED unless separately resolved.
- Zero rows does not automatically approve destructive SQL.

## ConnectedMailbox / PR #6 classification

Choose one:
- BLOCKED_NO_PROOF
- CONNECTED_MAILBOX_TABLE_MISSING
- CONNECTED_MAILBOX_SHAPE_MATCHES_ASSUMPTION
- CONNECTED_MAILBOX_SHAPE_CONFLICTS_WITH_PR_6
- CONNECTED_MAILBOX_PROOF_FAILED

Classification:

Notes:
- Do not include mailbox tokens, email content, OAuth secrets, or user-level mailbox data.

## Overall verdict

Default:
- NOT_RUN

Choose:
- NOT_RUN
- PASS
- FAIL
- BLOCKED

Reason:

Next required action:

## Verdict consistency rule

PASS is valid only when Evidence status is PASS and all required proof sections are completed.

If Evidence status is NOT_RUN, the Overall verdict must remain NOT_RUN or BLOCKED.

If any required proof target is missing, unverified, or unsafe to disclose, the Overall verdict must be FAIL or BLOCKED, not PASS.

PASS requires completed approved read-only execution, completed safety checklist, target environment confirmation, target table checks, migration state checks, EdgeNode proof, ConnectedMailbox proof, and reviewer sign-off.

## Reviewer sign-off
- Reviewer:
- Date:
- Approved for next phase? yes/no
- Next phase allowed:
- Conditions:
