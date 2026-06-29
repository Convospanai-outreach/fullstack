# Supabase Schema & Migration Proof Plan

Date: 2026-06-29
Repository: `Convospanai-outreach/fullstack`
Latest Main SHA: `04b64d1abe445fd0f83fa2d372e575d9bd1bb4ee`
PR #53 Status: **MERGED**

---

## 1. Context and Problem Statement

Infrastructure readiness checks on `main` currently query `SELECT 1` through Vercel and Railway health check endpoints. While this confirms TCP transport and database server liveness:
* **`SELECT 1` is insufficient** because it does not verify schema parity.
* If tables or columns are missing, mismatched, or altered, runtime queries (e.g. fetching leads or updating campaigns) will fail with database exceptions even while `/api/health` reports `healthy` (database `up`).
* A robust verification requires **proof of schema liveness and migration parity** without modifying or risking production data.

---

## 2. Read-Only Schema/Migration Proof Approach

To verify schema parity safely, we will use a **100% read-only diagnostic process**. We will query database metadata and compare it against the application's Prisma schemas.

> [!IMPORTANT]
> **CRITICAL RULE:** Do not run write-based schema changes, direct database pushes, or migration deployments (`npx prisma migrate deploy` or `supabase db push`) against the production Supabase database. All commands must be strictly read-only diagnostics.

### Safe Verification Commands

For local or staging environments (where database connection strings are available):

1. **Check Migration Status**:
   Confirm whether all migration directories are applied to the target database.
   ```bash
   npx prisma migrate status --schema apps/web/prisma/schema.prisma
   ```

2. **Verify Schema Drift (Diff)**:
   Generate a SQL diff between the live database and the expected Prisma schema. If the output is empty, there is zero drift.
   ```bash
   npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel apps/web/prisma/schema.prisma --script
   ```

---

## 3. Expected Schema Inventory to Verify

The following tables and fields are critical for app operation and must be checked for existence and correct type mapping:

* **User Auth & Sync**:
  * Table `User`: Must verify presence of column `clerk_user_id` (`clerkUserId` in Prisma).
  * Tables `UserInvitation` and `invite_requests` (required for Clerk-based signup flows).
* **Tenant & Teams**:
  * Table `TeamMember` and its relations.
* **Outreach Core**:
  * Table `Campaign`: expected fields and statuses.
  * Table `Lead`: expected columns, especially the type of `embedding` (type must match `String?` / `text` to align with the Phase 4 Option B resolution).
  * Table `EdgeNode`: ensuring no quarantine-restricted tables are modified.

### ConnectedMailbox Schema Drift Risk (PR #6)

PR #6 remains open and blocked. It introduces a high risk of schema drift around the `ConnectedMailbox` model. Specifically:
* PR #6 includes potential alterations to mailbox credential fields (such as access tokens, refresh tokens, and expirations).
* It introduces new models like `EmailActivityLog` and `EmailTrackedLink` which do not exist in the canonical `packages/db` schema.
* We must verify that the live database schema has not been contaminated by PR #6's proposed structures.

---

## 4. Pass and Fail Criteria

### PASS Criteria
* `prisma migrate status` returns that all local migrations are applied.
* `prisma migrate diff` output is empty (0 drift) or contains only audited, non-breaking additive structures.
* All required tables (`User`, `TeamMember`, `UserInvitation`, `invite_requests`) exist.
* Columns (`User.clerk_user_id`, `Lead.embedding` as text) match the canonical Prisma model definition.

### FAIL Criteria
* `migrate status` indicates missing, unapplied, or failed migrations.
* `migrate diff` shows missing tables or columns expected by current `main` runtime code.
* Destructive SQL is generated (e.g. `DROP TABLE`, `ALTER TABLE ... DROP COLUMN`).
* ConnectedMailbox structure diverges from the canonical model.

---

## 5. Remaining Blockers

The product remains **NOT_READY** for production release. The following blockers must be addressed after schema proof verification:

1. **Clerk User/Team Linkage**: Verify user provisioning webhook and Clerk synchronization.
2. **Redis/Cache Isolation**: Confirm Redis Preview namespace isolation.
3. **PR #6 (Gmail business mail)**: Blocked until schema convergence is locked.
4. **Stage 12A Security Gate**: Minimum security audit is not started.
