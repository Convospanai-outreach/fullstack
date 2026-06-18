# Auth Schema Repair Plan

Last updated: 2026-06-18

Status: Plan only. No migration generated or applied in this pass.

## Problem

The web auth/onboarding code expects schema objects that are missing from the observed live Supabase database:

- `User.clerk_user_id`
- `UserInvitation`
- `invite_requests`

Relevant code path:

- `apps/web/src/lib/clerkAuth.ts`

The Clerk sync path looks up users by `clerkUserId`, links existing users by email, and gates new users through approved invite requests.

## Repair Principles

- Repair must be additive.
- Do not drop or rewrite existing auth data.
- Do not run production migrations until canonical schema strategy is approved.
- Generate a draft migration only after the canonical Prisma schema decision is accepted.
- Keep PR #6 out of this repair path unless it is split into a focused schema PR.

## Proposed Additive Objects

### `User.clerk_user_id`

Add nullable column and unique index:

```sql
ALTER TABLE "User" ADD COLUMN "clerk_user_id" TEXT;
CREATE UNIQUE INDEX "User_clerk_user_id_key" ON "User"("clerk_user_id");
```

Safety notes:

- Nullable avoids forcing immediate backfill.
- Unique index permits multiple nulls in Postgres.
- Backfill from Clerk should be explicit and audited later.

### `UserInvitation`

Create invitation table for team-scoped invitations:

- `id`
- `email`
- `role`
- `teamId`
- `invitedById`
- `tokenHash`
- `status`
- `expiresAt`
- `acceptedAt`
- `invite_request_id`
- `createdAt`

Safety notes:

- No existing rows are modified.
- Foreign keys should reference `Team`, `User`, and `invite_requests`.
- If `UserRole` enum values are missing, enum additions must be included before table creation.

### `invite_requests`

Create invite request table mapped from Prisma model `InviteRequest`:

- `id`
- `name`
- `email`
- `company`
- `linkedin_url`
- `use_case`
- `status`
- `invite_token`
- `approved_by_id`
- `approved_at`
- `used_at`
- `created_at`
- `updated_at`

Safety notes:

- No existing rows are modified.
- This table supports waitlist/invite gating for Clerk signups.

## Draft Migration Timing

Do not generate the migration in this pass.

Generate a draft migration only after:

1. Canonical schema source is approved.
2. `Lead.embedding` canonical type is resolved.
3. Unsafe `EdgeNode` migration is split or removed from the production migration path.
4. The migration target is known to be `DIRECT_URL`, not runtime pooler URL if direct connection is required.

## Verification Plan

After a draft migration is generated, use the read-only verifier to confirm:

- `User.clerk_user_id` exists.
- `UserInvitation` exists.
- `invite_requests` exists.
- `_prisma_migrations` latest migration is the expected repair migration.
- Schema fingerprint matches the approved post-repair fingerprint.

## Rollback Posture

Because this repair should be additive, rollback should normally be:

- Disable Clerk invite-gated rollout at app/config level.
- Leave additive schema in place unless a separate reviewed rollback migration is required.
- Do not drop invitation tables if they may contain audit/security relevant onboarding evidence.
