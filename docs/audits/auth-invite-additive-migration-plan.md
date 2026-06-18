# Additive Auth & Onboarding Migration Plan

Agent: prisma-drift-agent  
Phase: 5 - Live/Staging DB verification and additive migration preparation  
Branch: `codex/db-linkage-swarm-orchestration`  
Last updated: 2026-06-18  

> [!IMPORTANT]
> This plan is for preparation and safety review only.
> **DO NOT** generate or apply any migration files or run SQL statements against the production database at this stage.

---

## 1. Migration Strategy: Strictly Additive

This migration aims to repair the authentication and invite table gaps in the live database. It is **100% additive** and designed for zero downtime:
* There are no table drops or column drops.
* New columns are defined as nullable (`clerk_user_id`), avoiding row expand and write locks on existing data.
* New tables and indexes are net-new, allowing existing features to operate uninterrupted.

---

## 2. Planned SQL Script

This SQL represents the exact additive structural changes:

```sql
-- 1. Create custom enums
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE "InviteRequestStatus" AS ENUM ('WAITLISTED', 'APPROVED', 'INVITED', 'ACTIVE', 'USED', 'REJECTED');

-- 2. Add nullable unique clerk_user_id column to User
ALTER TABLE "User" ADD COLUMN "clerk_user_id" TEXT;

-- 3. Create new invite_requests table
CREATE TABLE "invite_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "linkedin_url" TEXT NOT NULL,
    "use_case" TEXT NOT NULL,
    "status" "InviteRequestStatus" NOT NULL DEFAULT 'WAITLISTED',
    "invite_token" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_requests_pkey" PRIMARY KEY ("id")
);

-- 4. Create new UserInvitation table
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invite_request_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- 5. Create required indexes and constraints
CREATE UNIQUE INDEX "User_clerk_user_id_key" ON "User"("clerk_user_id");

CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");
CREATE INDEX "UserInvitation_email_idx" ON "UserInvitation"("email");
CREATE INDEX "UserInvitation_teamId_idx" ON "UserInvitation"("teamId");
CREATE INDEX "UserInvitation_invitedById_idx" ON "UserInvitation"("invitedById");
CREATE INDEX "UserInvitation_invite_request_id_idx" ON "UserInvitation"("invite_request_id");
CREATE INDEX "UserInvitation_status_idx" ON "UserInvitation"("status");
CREATE INDEX "UserInvitation_expiresAt_idx" ON "UserInvitation"("expiresAt");

CREATE UNIQUE INDEX "invite_requests_invite_token_key" ON "invite_requests"("invite_token");
CREATE INDEX "invite_requests_email_idx" ON "invite_requests"("email");
CREATE INDEX "invite_requests_status_idx" ON "invite_requests"("status");
CREATE INDEX "invite_requests_created_at_idx" ON "invite_requests"("created_at");
CREATE INDEX "invite_requests_approved_by_id_idx" ON "invite_requests"("approved_by_id");

-- 6. Create foreign key relations
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_teamId_fkey" 
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invitedById_fkey" 
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invite_request_id_fkey" 
    FOREIGN KEY ("invite_request_id") REFERENCES "invite_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invite_requests" ADD CONSTRAINT "invite_requests_approved_by_id_fkey" 
    FOREIGN KEY ("approved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## 3. Risk Assessment & Mitigations

### A. Enum Expansion Risk (`UserRole`)
* **Problem**: `UserInvitation` references the `UserRole` enum. If the live database `UserRole` enum lacks values like `SUPER_ADMIN`, `CMS_EDITOR`, or `VIEWER` (which were synced locally), the table creation statement will succeed but future inserts containing those values will fail with enum violations.
* **Mitigation**: Preflight checks must query enum values. If any synced roles are missing live, add them via `ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';` in a safe, transaction-isolated step prior to creating `UserInvitation`.

### B. Idempotency & Preflight Checks
* Before executing, the script should check:
  * Does `User.clerk_user_id` already exist?
  * Do `UserInvitation` or `invite_requests` tables already exist?
  * Do `InvitationStatus` or `InviteRequestStatus` type names conflict with existing objects?
* If any objects exist, the migration must either be skipped or modified to prevent duplicate type/table creation errors.

### C. Rollback Limitations
* **Limitation**: Postgres does not automatically drop custom types during a simple table rollback.
* **Rollback Script Plan**:
  ```sql
  -- Remove constraints and tables
  DROP TABLE IF EXISTS "UserInvitation" CASCADE;
  DROP TABLE IF EXISTS "invite_requests" CASCADE;
  
  -- Remove added column
  ALTER TABLE "User" DROP COLUMN IF EXISTS "clerk_user_id";
  
  -- Remove custom enums
  DROP TYPE IF EXISTS "InvitationStatus";
  DROP TYPE IF EXISTS "InviteRequestStatus";
  ```
* **Caution**: Dropping columns or types can destroy any data written during the window. Ensure backups are current.

### D. Backup Requirement
* **Mandatory Action**: A full logical backup (`pg_dump`) of the Supabase public schema must be completed and stored securely before any DDL statements are executed.

---

## 4. Manual Approval Gate

No automated script should run this migration. It requires:
1. **Developer validation** of preflight checks using `live-schema-verify-plan.md`.
2. **Review of target branch green status** on GitHub Actions.
3. **Manual signing** and validation of the SQL script by the engineering team or CTO.
4. **Execution via Supabase console** or controlled deployment scripts.
