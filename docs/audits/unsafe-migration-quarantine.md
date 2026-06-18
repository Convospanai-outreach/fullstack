# Unsafe Migration Quarantine

Last updated: 2026-06-18

Migration: `20260604140000_edge_runtime_pairing`

Locations:

- `apps/web/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql`
- `apps/api/prisma/migrations/20260604140000_edge_runtime_pairing/migration.sql`

Status: Quarantined. Do not run in production as-is.

## Destructive Statements

The migration contains one destructive data mutation:

```sql
DELETE FROM "EdgeNode"
WHERE NOT EXISTS (
  SELECT 1 FROM "Team" WHERE "Team"."id" = "EdgeNode"."teamId"
);
```

This deletes `EdgeNode` rows whose `teamId` does not currently match a `Team` row.

## Other Risky Statements

The following statements are not destructive deletes, but still need production review:

```sql
ALTER TABLE "EdgeNode" ALTER COLUMN "ipAddress" DROP NOT NULL;
```

This relaxes a constraint and is likely safe, but it changes data contract semantics.

```sql
UPDATE "EdgeNode"
SET "lastSeenAt" = COALESCE("lastSeenAt", "lastSync")
WHERE "lastSeenAt" IS NULL;
```

This is a data backfill. It is not destructive, but production row counts and runtime effects should be reviewed.

```sql
ALTER TABLE "EdgeNode"
  ADD CONSTRAINT "EdgeNode_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

This is useful, but can fail if orphan rows exist. It should be applied only after non-destructive orphan handling.

## Safe Replacement Plan

### 1. Preflight Check

Run a read-only query before any migration:

```sql
SELECT
  COUNT(*) AS edge_node_count,
  COUNT(*) FILTER (
    WHERE NOT EXISTS (
      SELECT 1 FROM "Team" WHERE "Team"."id" = "EdgeNode"."teamId"
    )
  ) AS orphan_edge_node_count
FROM "EdgeNode";
```

If `orphan_edge_node_count = 0`, the destructive cleanup is unnecessary.

### 2. Backup/Audit Table If Needed

If orphan rows exist, create a reviewed backup/audit table in a separate approved migration:

```sql
CREATE TABLE IF NOT EXISTS "EdgeNodeOrphanAudit" AS
SELECT
  "EdgeNode".*,
  now() AS "auditedAt",
  'pre_fk_orphan_quarantine'::text AS "auditReason"
FROM "EdgeNode"
WHERE NOT EXISTS (
  SELECT 1 FROM "Team" WHERE "Team"."id" = "EdgeNode"."teamId"
);
```

This example must be reviewed before use because `CREATE TABLE AS` copies the current column shape and may need an explicit schema for long-term auditability.

### 3. Non-Destructive Migration

Apply only additive/non-destructive parts:

- Relax `ipAddress` nullability if still desired.
- Add new nullable/defaulted columns.
- Backfill `lastSeenAt` from `lastSync`.
- Add indexes.

Do not delete rows in the non-destructive migration.

### 4. Manual Approval For Cleanup

If orphan rows exist, decide manually:

- Reattach orphan rows to a valid team.
- Archive and soft-disable orphan rows.
- Delete only after explicit approval, backup, and a recorded ticket.

Only after cleanup is approved should the FK constraint be added.

## Required Approval Gate

Before any production migration involving `EdgeNode`:

1. Preflight result is attached to the PR.
2. Orphan row count is documented.
3. Backup/audit approach is reviewed.
4. Cleanup policy is approved.
5. Final migration contains no unreviewed `DELETE`, `TRUNCATE`, or destructive `DROP`.

## Current Decision

Do not edit or run the existing migration in this pass. Treat it as quarantined until a replacement migration sequence is drafted and approved.
