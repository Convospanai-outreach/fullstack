# Supabase Schema & Migration Verification Results

Date: 2026-06-29
Repository: `Convospanai-outreach/fullstack`
Latest Main SHA: `33b46cc598007ea45f1b51fc3a5a8a1ff14ebbc8`

---

## 1. Safe Verification Scripts Added

To verify the database schema and migration status without making any changes to production, we have added two read-only diagnostic scripts:

1. **`scripts/readiness/check-db-shape.ts`**:
   Checks for the existence of key tables and analyzes the columns of the `ConnectedMailbox` table to detect any drift or contamination from PR #6.
2. **`scripts/readiness/check-migration-status.ts`**:
   Reads metadata from the `_prisma_migrations` table to confirm that all migrations are correctly applied.

> [!IMPORTANT]
> **NO PRODUCTION MUTATION PERFORMED:** These scripts perform only read-only queries against database system catalogs. They do not execute `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP`, or `TRUNCATE` commands. No migrations are applied or run.

---

## 2. Safe Execution Commands

### Local Environment Verification
Run these commands from the repository root:
```bash
# Check tables presence and column drift
npm run readiness:check-db-shape

# Check migration status metadata
npm run readiness:check-migration-status
```

### Remote / Production Read-Only Verification
When running against a remote Supabase or Railway Postgres database instance, the scripts will halt unless the explicit production read-only safety flag is provided:
```bash
# Run remote db shape checks
npm run readiness:check-db-shape -- --allow-production-readonly

# Run remote migration status checks
npm run readiness:check-migration-status -- --allow-production-readonly
```

---

## 3. Evaluation Criteria

### PASS Criteria
* **Tables Presence**: `User`, `Team`, `TeamMember`, `ConnectedMailbox`, `Email`, `Campaign`, `Workflow`, and `Lead` are all `PRESENT`.
* **ConnectedMailbox Columns**: Results show `Canonical Main Shape (No Drift, PASS)` matching:
  * `assignedUserId`, `email`, `encryptedAccessToken`, `encryptedRefreshToken`, `tokenExpiresAt`.
* **Migration status**: `_prisma_migrations` contains all local migration directories marked as finished without errors.

### FAIL Criteria
* Any expected table is reported as `MISSING`.
* ConnectedMailbox resembles the PR #6 conflicting shape matching:
  * `emailAddress`, `accessTokenEncrypted`, `refreshTokenEncrypted`, `expiresAt`.
* `_prisma_migrations` contains unapplied, failed, or missing migration logs.

---

## 4. Execution Evidence Upload Placeholder

*Please execute the scripts above on the target database, and copy/paste the verbatim stdout here during the manual review phase:*

```text
[PASTE SCRIPT RUN STDOUT HERE]
```

---

## 5. Verification Verdict

Supabase Schema & Migration Proof Status: **NEEDS_RUN**
Overall Product Readiness: **NOT_READY**
PR #6 Status: **BLOCKED_PENDING_SCHEMA_DRIFT_PROOF**
