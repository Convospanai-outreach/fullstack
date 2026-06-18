# API Auth Schema Sync Plan

Agent: prisma-drift-agent / auth-tenant-agent  
Phase: 4 — Prisma drift resolution  
Branch: `codex/db-linkage-swarm-orchestration` @ `b9fd15d`  
Last updated: 2026-06-18  
Status: **PLAN READY — schema edits and migrations blocked pending orchestrator approval**

---

## Purpose

This document lists the exact Prisma additions required in `apps/api/prisma/schema.prisma` to make the API schema align with `apps/web/prisma/schema.prisma` for auth and onboarding models.

**No schema edits have been made yet.**  
**No migrations have been generated yet.**  
This is a pre-approved plan only.

---

## Current gap (from Phase 4 drift matrix)

The following items exist in `apps/web` (and `packages/db`) but are **completely absent** from `apps/api`:

| Item | Type | Web schema reference | API schema | Live Supabase |
| --- | --- | --- | --- | --- |
| `clerkUserId` | Field on `User` | Line 1154 | Absent | Absent (`clerk_user_id` col missing) |
| `sentInvitations` | Relation on `User` | Line 1186 | Absent | — |
| `approvedInviteRequests` | Relation on `User` | Line 1187 | Absent | — |
| `InvitationStatus` | Enum | Lines ~(after UserInvitation) | Absent | — |
| `InviteRequestStatus` | Enum | Lines ~(after InviteRequest) | Absent | — |
| `UserInvitation` | Model | Lines 1198–1221 | Absent | Table missing live |
| `InviteRequest` | Model | Lines 1223–1246 | Absent | Table assumed missing live |

---

## Exact Prisma additions required

All snippets below are taken verbatim from `apps/web/prisma/schema.prisma` as of commit `b9fd15d`.  
Do not modify these snippets before reviewing against the current web schema file.

---

### 1. User model additions

Add to the existing `User` model in `apps/api/prisma/schema.prisma`, in the same position as in `apps/web` (after the `id` field, before `email`):

```prisma
clerkUserId String? @unique @map("clerk_user_id")
```

Add to the `User` model relation block (after `datasetReviews DatasetReview[]`):

```prisma
sentInvitations        UserInvitation[]
approvedInviteRequests InviteRequest[] @relation("InviteRequestApprovedBy")
```

**Full User field reference (web schema lines 1152–1196):**

```prisma
model User {
  id                  String             @id @default(uuid())
  clerkUserId         String?            @unique @map("clerk_user_id")  // ADD THIS
  email               String             @unique
  password            String?
  emailVerified       DateTime?
  name                String?
  image               String?
  address             String?
  role                String             @default("user")
  enterpriseRole      UserRole           @default(SALES_USER)
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt
  // ... existing fields ...
  sentInvitations    UserInvitation[]                                    // ADD THIS
  approvedInviteRequests InviteRequest[] @relation("InviteRequestApprovedBy") // ADD THIS
  // ... existing fields ...
}
```

---

### 2. InvitationStatus enum

Add as a new top-level enum (locate near other enums, after `InviteRequestStatus`):

```prisma
enum InvitationStatus {
  pending
  accepted
  expired
  cancelled
}
```

> Source: `apps/web/prisma/schema.prisma` — locate by searching `enum InvitationStatus`.

---

### 3. InviteRequestStatus enum

Add as a new top-level enum:

```prisma
enum InviteRequestStatus {
  WAITLISTED
  APPROVED
  REJECTED
  USED
}
```

> Source: `apps/web/prisma/schema.prisma` — locate by searching `enum InviteRequestStatus`.

---

### 4. UserInvitation model

Add as a new top-level model (verbatim from web schema lines 1198–1221):

```prisma
model UserInvitation {
  id              String           @id @default(uuid())
  email           String
  role            UserRole
  teamId          String
  invitedById     String
  tokenHash       String           @unique
  status          InvitationStatus @default(pending)
  expiresAt       DateTime
  acceptedAt      DateTime?
  inviteRequestId String?          @map("invite_request_id")
  createdAt       DateTime         @default(now())

  team          Team           @relation(fields: [teamId], references: [id], onDelete: Cascade)
  invitedBy     User           @relation(fields: [invitedById], references: [id])
  inviteRequest InviteRequest? @relation(fields: [inviteRequestId], references: [id], onDelete: SetNull)

  @@index([email])
  @@index([teamId])
  @@index([invitedById])
  @@index([inviteRequestId])
  @@index([status])
  @@index([expiresAt])
}
```

---

### 5. InviteRequest model

Add as a new top-level model (verbatim from web schema lines 1223–1246):

```prisma
model InviteRequest {
  id           String              @id @default(uuid())
  name         String
  email        String
  company      String
  linkedinUrl  String              @map("linkedin_url")
  useCase      String              @map("use_case") @db.Text
  status       InviteRequestStatus @default(WAITLISTED)
  inviteToken  String?             @unique @map("invite_token")
  approvedById String?             @map("approved_by_id")
  approvedAt   DateTime?           @map("approved_at")
  usedAt       DateTime?           @map("used_at")
  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  approvedBy User?            @relation("InviteRequestApprovedBy", fields: [approvedById], references: [id])
  invitations UserInvitation[]

  @@index([email])
  @@index([status])
  @@index([createdAt])
  @@index([approvedById])
  @@map("invite_requests")
}
```

---

### 6. Team model addition

Add to the existing `Team` model in `apps/api`:

```prisma
userInvitations UserInvitation[]
```

> The `Team` model in `apps/web` already has this relation (line 965). The API `Team` model must match.

---

## Migration SQL that will be required (planning only — do not generate yet)

When the schema edits are approved and `prisma migrate dev` or `prisma migrate diff` is run against a non-production DB, the expected SQL additions are:

```sql
-- Add clerk_user_id to User
ALTER TABLE "User" ADD COLUMN "clerk_user_id" TEXT UNIQUE;

-- Create InvitationStatus enum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- Create InviteRequestStatus enum
CREATE TYPE "InviteRequestStatus" AS ENUM ('WAITLISTED', 'APPROVED', 'REJECTED', 'USED');

-- Create UserInvitation table
CREATE TABLE "UserInvitation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "invitedById" TEXT NOT NULL REFERENCES "User"("id"),
  "tokenHash" TEXT NOT NULL UNIQUE,
  "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "invite_request_id" TEXT REFERENCES "invite_requests"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create invite_requests table
CREATE TABLE "invite_requests" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "linkedin_url" TEXT NOT NULL,
  "use_case" TEXT NOT NULL,
  "status" "InviteRequestStatus" NOT NULL DEFAULT 'WAITLISTED',
  "invite_token" TEXT UNIQUE,
  "approved_by_id" TEXT REFERENCES "User"("id"),
  "approved_at" TIMESTAMP(3),
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
```

> **This SQL is planning-only.** Do not run against production. The actual migration file must be generated by `prisma migrate dev` against a non-production DB, reviewed, and approved before being applied anywhere.

---

## Pre-conditions before executing schema edits

| Pre-condition | Status |
| --- | --- |
| `Lead.embedding` canonical type decided | **NEEDS_DECISION** (see `lead-embedding-decision.md`) |
| Orchestrator accepts this sync plan | **NEEDS_APPROVAL** |
| Fresh `npm run schema:verify:readonly` run against live DB | **QUEUED** |
| Non-production test DB available for `prisma migrate dev` | **NOT_CHECKED** |
| `apps/api` typecheck and lint green before schema edit | **NOT_CHECKED** |

---

## Safety guardrails

- Do not apply `prisma migrate deploy` to production until the migration is reviewed by `migration-safety-agent`.
- The `clerk_user_id` column addition is additive (nullable) — safe to apply without expanding existing rows.
- The `UserInvitation` and `invite_requests` table additions are net-new — safe to apply additively.
- Enum additions (`InvitationStatus`, `InviteRequestStatus`) are additive.
- No columns are dropped, renamed, or type-changed by this plan.
- This plan is fully additive (expand-only, no contract).

---

## Execution order (when approved)

1. Edit `apps/api/prisma/schema.prisma` — add all items listed above.
2. Run `npx prisma validate --schema apps/api/prisma/schema.prisma` — confirm schema is valid.
3. Run `npm run db:schema:compare` — confirm compare output matches expected new state.
4. Run `npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name add_clerk_auth_invite_schema` against a **non-production** DB.
5. Review generated SQL against the planning SQL above.
6. Submit migration for `migration-safety-agent` review.
7. Apply to live Supabase only after review + approval + backup confirmation.

---

## References

- `docs/audits/prisma-schema-drift-matrix.md` — Phase 4 evidence
- `apps/web/prisma/schema.prisma` — source of truth for all snippets above
- `apps/api/prisma/schema.prisma` — target file for additions
- `docs/audits/auth-schema-repair-plan.md` — earlier auth repair notes
