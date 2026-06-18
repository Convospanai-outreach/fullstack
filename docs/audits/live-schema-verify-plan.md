# Live/Staging DB Schema Verification Plan

Agent: prisma-drift-agent  
Phase: 5 - Live/Staging DB verification and additive migration preparation  
Branch: `codex/db-linkage-swarm-orchestration`  
Last updated: 2026-06-18  

This document outlines the exact, read-only SQL queries and validation steps required to perform a comprehensive schema and metadata verification of the live/staging Supabase database (Postgres 17) before applying any migrations.

---

## 1. Execution Guidelines

* **Safety**: This plan is strictly **read-only**. It contains no `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, or `DELETE` statements.
* **Environment**: These checks can be executed via:
  1. The Supabase SQL Editor dashboard.
  2. A local or terminal `psql` connection using the `DIRECT_URL`.
  3. The `npm run schema:verify:readonly` script (once connection environment variables are set).
* **Target Database Ref**: `izqcycslipmbgdwgajvu` (Supabase project `Fullstack2026`).

---

## 2. Verification SQL Script

Execute the following consolidated query block to inspect database metadata:

```sql
-- ============================================================================
-- CraftMyFunnel Live DB Read-Only Schema Verification Suite
-- ============================================================================

-- 1. Verify connection context, current database, user, and active schema
SELECT 
    current_database() AS db_name, 
    current_user AS db_user, 
    current_schema() AS schema_name,
    version() AS postgres_version;

-- 2. Verify Prisma Migrations table status, total count, and latest run
SELECT 
    COUNT(*)::integer AS total_migrations,
    (SELECT migration_name FROM public._prisma_migrations ORDER BY started_at DESC LIMIT 1) AS latest_migration
FROM public._prisma_migrations;

-- 3. List the 50 most recent migration names and execution timestamps
SELECT 
    migration_name, 
    started_at, 
    finished_at, 
    rolled_back_at
FROM public._prisma_migrations
ORDER BY started_at DESC, migration_name DESC
LIMIT 50;

-- 4. Check presence of core auth/invite tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('User', 'UserInvitation', 'invite_requests');

-- 5. Verify presence and metadata of the User.clerk_user_id column
SELECT 
    table_name, 
    column_name, 
    data_type, 
    udt_name, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'User'
  AND column_name = 'clerk_user_id';

-- 6. Check presence of custom enums (InvitationStatus, InviteRequestStatus, UserRole)
SELECT 
    t.typname AS enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname IN ('InvitationStatus', 'InviteRequestStatus', 'UserRole')
GROUP BY t.typname;

-- 7. Check Lead.embedding datatype configuration
SELECT 
    table_name, 
    column_name, 
    data_type, 
    udt_name, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Lead'
  AND column_name = 'embedding';

-- 8. Verify live existence and status of core messaging & suppression tables
SELECT 
    table_name, 
    exists(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) AS is_present
FROM (
    VALUES 
        ('ConnectedMailbox'), 
        ('Email'), 
        ('EmailEvent'), 
        ('TrackedLink'), 
        ('SuppressionEntry')
) AS t(table_name);

-- 9. Inspect full column structure of ConnectedMailbox
SELECT 
    column_name, 
    data_type, 
    udt_name, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ConnectedMailbox'
ORDER BY ordinal_position;

-- 10. Preflight check for EdgeNode table and orphan team relations
SELECT 
    (SELECT COUNT(*) FROM public."EdgeNode") AS edge_node_count,
    (
        SELECT COUNT(*) 
        FROM public."EdgeNode" 
        WHERE "teamId" NOT IN (SELECT id FROM public."Team")
    ) AS orphan_edge_nodes;
```

---

## 3. Evaluation Criteria (Expected vs. Actual)

### A. Core Database & Identity
* **Expected db_name**: `postgres` (or as provisioned on Supabase).
* **Expected schema_name**: `public`.
* **Expected postgres_version**: Contains `Postgres 17` or `PostgreSQL 17`.

### B. Migration State
* **Expected total_migrations**: `17` (based on prior registry snapshots).
* **Expected latest_migration**: Matches the last successful migration recorded in the manifest.

### C. Clerk/Invite Schema Gap (Confirming Drift is Still Live)
* **clerk_user_id column**: Expected to be **Absent** (returns 0 rows) if not yet migrated.
* **UserInvitation table**: Expected to be **Absent** (returns 0 rows).
* **invite_requests table**: Expected to be **Absent** (returns 0 rows).
* **InvitationStatus enum**: Expected to be **Absent** (returns 0 rows).
* **InviteRequestStatus enum**: Expected to be **Absent** (returns 0 rows).

### D. UserRole Enum Parity
* **Expected enum_values for UserRole**: Must contain `SUPER_ADMIN`, `CMS_EDITOR`, and `VIEWER`. If they are missing from the live database, this represents a migration drift blocker that must be fixed via enum alteration.

### E. Embedding Datatype
* **Expected datatype for Lead.embedding**: Should be `text` or `varchar` (UDT `text`) to verify alignment with Option B (String? canonical).

### F. EdgeNode Preflight
* **Expected orphan_edge_nodes**: Must be `0` (verifies no invalid relations exist before applying constraints).
