# Prisma Schema Drift Matrix

Agent: prisma-drift-agent  
Phase: 4 - Prisma drift resolution  
Branch: `codex/db-linkage-swarm-orchestration` @ `7e82c01`  
Last updated: 2026-06-18  

## Evidence sources

| Source | Evidence method | Notes |
| --- | --- | --- |
| `packages/db/prisma/schema.prisma` | Direct file inspection | Identical to `apps/web`; sha256=`c8f570cb…` |
| `apps/web/prisma/schema.prisma` | Direct file inspection | 2364 lines; sha256=`c8f570cb…` |
| `apps/api/prisma/schema.prisma` | Direct file inspection | 2291 lines; sha256=`a971cc74…` |
| Live Supabase (`izqcycslipmbgdwgajvu`) | Prior read-only SQL inspection (prior swarm runs) | Not re-queried this session; prior findings recorded in `VERIFICATION_MATRIX.md` |

> Live Supabase evidence is from prior swarm runs. A fresh `npm run schema:verify:readonly` run against production must be done before any migration is drafted.

---

## Verdict key

| Verdict | Meaning |
| --- | --- |
| MATCH | Identical across all four sources |
| WEB_ONLY | Present in `apps/web` (and `packages/db`) but absent in `apps/api` |
| API_MISSING | `apps/api` schema is missing this model/field entirely |
| TYPE_DRIFT | Same column, different Prisma type between web and API |
| LIVE_DRIFT | Schema differs from known live Supabase state |
| FIELD_DRIFT | Field-level difference (name or definition) between web and API |
| NOT_IN_EITHER | Not present in any local schema; may be in PR #6 or live only |
| NOT_CHECKED_LIVE | Live state not confirmed by read-only SQL this session |

---

## Model-level presence matrix

| Model / Enum | packages/db | apps/web | apps/api | Live Supabase | Verdict |
| --- | --- | --- | --- | --- | --- |
| `Lead` | ✅ | ✅ | ✅ | ✅ (confirmed) | TYPE_DRIFT on `embedding` |
| `Email` | ✅ | ✅ | ✅ | ✅ (confirmed) | MATCH (field-level identical) |
| `ConnectedMailbox` | ✅ | ✅ | ✅ | ✅ (confirmed) | MATCH (field-level identical) |
| `EmailEvent` | ✅ | ✅ | ✅ | ✅ (confirmed) | MATCH; no `EmailActivityLog` in either local schema |
| `TrackedLink` | ✅ | ✅ | ✅ | NOT_CHECKED_LIVE | MATCH (field-level identical) |
| `SuppressionEntry` | ✅ | ✅ | ✅ | NOT_CHECKED_LIVE | MATCH (field-level identical) |
| `WaitlistRequest` | ❌ | ❌ | ❌ | NOT_CHECKED_LIVE | NOT_IN_EITHER (PR #6 proposes adding it) |
| `UserInvitation` | ✅ | ✅ | ❌ | ❌ (missing live) | WEB_ONLY / API_MISSING / LIVE_DRIFT |
| `InviteRequest` | ✅ | ✅ | ❌ | NOT_CHECKED_LIVE | WEB_ONLY / API_MISSING |
| `InvitationStatus` (enum) | ✅ | ✅ | ❌ | NOT_CHECKED_LIVE | WEB_ONLY / API_MISSING |
| `InviteRequestStatus` (enum) | ✅ | ✅ | ❌ | NOT_CHECKED_LIVE | WEB_ONLY / API_MISSING |
| `User` | ✅ | ✅ | ✅ | ✅ (confirmed) | FIELD_DRIFT on `clerkUserId` and relations |
| `TeamMember` | ✅ | ✅ | ✅ | ✅ (confirmed) | MATCH |
| `EmailActivityLog` | ❌ | ❌ | ❌ | NOT_CHECKED_LIVE | NOT_IN_EITHER (PR #6 concern only) |
| `EmailTrackedLink` | ❌ | ❌ | ❌ | NOT_CHECKED_LIVE | NOT_IN_EITHER (PR #6 concern only) |

---

## Field-level drift detail

### Lead.embedding

| Source | Prisma type | Notes |
| --- | --- | --- |
| `packages/db` | `Unsupported("vector(1536)")?` | Inherits from `apps/web` |
| `apps/web` | `Unsupported("vector(1536)")?` | Requires `postgresqlExtensions` preview feature and `vector` extension |
| `apps/api` | `String?` | Deliberately downgraded; comment: "Temporarily String to match DB state and unblock push" |
| Live Supabase | `text` (nullable) | Confirmed by prior read-only inspection; `vector` extension is installed |

**Verdict:** TYPE_DRIFT + LIVE_DRIFT  
**Risk:** API and web will generate different SQL for this column. Any migration from web schema will alter the column type; any migration from API schema will not. Web schema cannot currently be applied to live DB without a migration that changes `text` → `vector(1536)`.  
**Decision required:** Choose one canonical type before any migration is drafted:
- Option A: `Unsupported("vector(1536)")` — requires `ALTER COLUMN` migration on live DB; unblocks vector search
- Option B: `String?` — matches live state; defers vector work; both schemas converge with API
- Option C: `String?` short-term in `packages/db`; tracked separate migration task for vector upgrade

---

### User.clerkUserId

| Source | Field definition | Notes |
| --- | --- | --- |
| `packages/db` | `clerkUserId String? @unique @map("clerk_user_id")` | Inherits from `apps/web` |
| `apps/web` | `clerkUserId String? @unique @map("clerk_user_id")` | Required for Clerk ↔ app user sync |
| `apps/api` | **absent** | Field does not exist in API User model |
| Live Supabase | **absent** (`clerk_user_id` column missing) | Confirmed by prior read-only inspection |

**Verdict:** WEB_ONLY / API_MISSING / LIVE_DRIFT  
**Risk:** Clerk webhook/user sync path in `apps/web` depends on `clerk_user_id`. Live DB and API schema both lack this column. Auth smoke will fail until this is addressed.  
**Decision required:** Add `clerkUserId` to `apps/api` User model AND generate/apply a reviewed additive migration to live DB. Must be a separate migration from any other schema change.

---

### User — invite-related relations

| Source | Present | Relations |
| --- | --- | --- |
| `packages/db` / `apps/web` | ✅ | `sentInvitations UserInvitation[]`, `approvedInviteRequests InviteRequest[] @relation("InviteRequestApprovedBy")` |
| `apps/api` | ❌ | Neither relation exists; `UserInvitation` and `InviteRequest` models are absent |
| Live Supabase | ❌ | `UserInvitation` table confirmed missing live |

**Verdict:** WEB_ONLY / API_MISSING  
**Risk:** Invite-gated onboarding depends on `invite_requests` and `UserInvitation`. Live DB lacks both. Any Clerk signup flow with invite gating will fail.

---

### ConnectedMailbox — field naming

| Field (web/packages/db) | Field (apps/api) | Live Supabase | Verdict |
| --- | --- | --- | --- |
| `email String` | `email String` | NOT_CHECKED_LIVE | MATCH |
| `encryptedAccessToken Json?` | `encryptedAccessToken Json?` | NOT_CHECKED_LIVE | MATCH |
| `encryptedRefreshToken Json?` | `encryptedRefreshToken Json?` | NOT_CHECKED_LIVE | MATCH |
| `tokenExpiresAt DateTime?` | `tokenExpiresAt DateTime?` | NOT_CHECKED_LIVE | MATCH |
| `historyId String?` | `historyId String?` | NOT_CHECKED_LIVE | MATCH |

> **Finding:** The previously flagged `ConnectedMailbox` naming conflicts (`email vs emailAddress`, `encryptedAccessToken vs accessTokenEncrypted`, `historyId vs gmailHistoryId`) do **not exist** in either current local schema. Both `apps/web` and `apps/api` use identical field names for `ConnectedMailbox`. These conflicts were a concern from PR #6, not from the current canonical schemas. No action required for the current local schemas.

---

### Email — field-level

| Field | apps/web | apps/api | Live Supabase | Verdict |
| --- | --- | --- | --- | --- |
| `id`, `leadId`, `campaignId`, `mailboxId` | ✅ | ✅ | NOT_CHECKED_LIVE | MATCH |
| `subject`, `body`, `status`, `providerId` | ✅ | ✅ | NOT_CHECKED_LIVE | MATCH |
| `threadId`, `trackingId`, `openedAt` | ✅ | ✅ | NOT_CHECKED_LIVE | MATCH |
| `clickedAt`, `repliedAt`, `bouncedAt`, `unsubscribedAt` | ✅ | ✅ | NOT_CHECKED_LIVE | MATCH |
| `createdAt`, relations | ✅ | ✅ | NOT_CHECKED_LIVE | MATCH |

**Finding:** `Email` model is field-for-field identical between `apps/web` and `apps/api`.

---

### EmailEvent vs EmailActivityLog

| Table | packages/db | apps/web | apps/api | Live Supabase | Verdict |
| --- | --- | --- | --- | --- | --- |
| `EmailEvent` | ✅ | ✅ | ✅ | ✅ (confirmed) | MATCH across all local schemas |
| `EmailActivityLog` | ❌ | ❌ | ❌ | NOT_CHECKED_LIVE | NOT_IN_EITHER |

**Finding:** `EmailActivityLog` does **not exist** in any current local schema. The duplication concern was raised from PR #6 which proposes adding it. No duplication exists in the current canonical schemas. If PR #6 is split, the `EmailActivityLog` addition must be reviewed against `EmailEvent` to decide whether it is additive or redundant.

---

### TrackedLink vs EmailTrackedLink

| Table | packages/db | apps/web | apps/api | Live Supabase | Verdict |
| --- | --- | --- | --- | --- | --- |
| `TrackedLink` | ✅ | ✅ | ✅ | NOT_CHECKED_LIVE | MATCH across all local schemas |
| `EmailTrackedLink` | ❌ | ❌ | ❌ | NOT_CHECKED_LIVE | NOT_IN_EITHER |

**Finding:** `EmailTrackedLink` does **not exist** in any current local schema. Same situation as `EmailActivityLog` — this is a PR #6 concern only. No action required for the current canonical schemas.

---

### SuppressionEntry — field-level

| Field | apps/web | apps/api | Verdict |
| --- | --- | --- | --- |
| `id`, `teamId`, `email` | ✅ | ✅ | MATCH |
| `reason` (default: `UNSUBSCRIBE`) | ✅ | ✅ | MATCH |
| `source` (default: `SYSTEM`) | ✅ | ✅ | MATCH |
| `leadId`, `createdBy`, `createdAt` | ✅ | ✅ | MATCH |
| `@@unique([teamId, email])` | ✅ | ✅ | MATCH |

**Finding:** `SuppressionEntry` is identical across all local schemas.

---

### WaitlistRequest

| Source | Present | Verdict |
| --- | --- | --- |
| `packages/db`, `apps/web`, `apps/api` | ❌ | NOT_IN_EITHER |
| Live Supabase | NOT_CHECKED_LIVE | — |

**Finding:** `WaitlistRequest` does not exist in any current local schema. This is a PR #6 addition. If added, it must be reviewed as a standalone additive migration only after the canonical schema decision is approved.

---

### UserInvitation — field-level (web only)

| Field | apps/web | apps/api | Verdict |
| --- | --- | --- | --- |
| `id`, `email`, `role`, `teamId` | ✅ | **absent** | WEB_ONLY |
| `invitedById`, `tokenHash`, `status` | ✅ | **absent** | WEB_ONLY |
| `expiresAt`, `acceptedAt`, `inviteRequestId` | ✅ | **absent** | WEB_ONLY |
| `createdAt`, relations | ✅ | **absent** | WEB_ONLY |
| `@@map` | not used | **absent** | WEB_ONLY |

**Live state:** `UserInvitation` table confirmed **missing** from live Supabase in prior inspection.  
**Risk:** All invite-gated signup flows fail at runtime.

---

### InviteRequest — field-level (web only)

| Field | apps/web | apps/api | Verdict |
| --- | --- | --- | --- |
| `id`, `name`, `email`, `company` | ✅ | **absent** | WEB_ONLY |
| `linkedinUrl`, `useCase`, `status` | ✅ | **absent** | WEB_ONLY |
| `inviteToken`, `approvedById`, `approvedAt` | ✅ | **absent** | WEB_ONLY |
| `usedAt`, `createdAt`, `updatedAt` | ✅ | **absent** | WEB_ONLY |
| `@@map("invite_requests")` | ✅ | **absent** | WEB_ONLY |

**Live state:** `invite_requests` table not confirmed by prior read-only SQL (was not in the checked table list). Assumed absent.  
**Risk:** Invite request workflow is blocked both on API side (no schema) and live DB (assumed absent).

---

## Summary of actions required (Phase 4 scope)

| Item | Priority | Action | Owner |
| --- | --- | --- | --- |
| `Lead.embedding` canonical type decision | HIGH | Choose Option A/B/C; update `packages/db` schema to match decision | orchestrator decision |
| `User.clerkUserId` additive migration | HIGH | Add field to `apps/api` User model; generate reviewed additive migration | auth-tenant-agent |
| `UserInvitation` + `InviteRequest` to `apps/api` | HIGH | Add models to API schema; generate reviewed additive migration | auth-tenant-agent |
| `UserInvitation` + `invite_requests` live migration | HIGH | Apply reviewed additive migration to live Supabase after approval | migration-safety-agent |
| `EmailActivityLog` vs `EmailEvent` | LOW | Document that `EmailActivityLog` is a PR #6 proposal only; no action on current schemas | pr-strategy-agent |
| `EmailTrackedLink` vs `TrackedLink` | LOW | Document that `EmailTrackedLink` is a PR #6 proposal only; no action on current schemas | pr-strategy-agent |
| `WaitlistRequest` | LOW | Document as PR #6 scope only; do not add to canonical schema without approval | pr-strategy-agent |
| `ConnectedMailbox` naming | RESOLVED | No conflict in current local schemas; PR #6 concern only | — |
| `SuppressionEntry` shape | RESOLVED | Identical across all local schemas | — |
| `Email` shape | RESOLVED | Identical across all local schemas | — |

## What must NOT happen before this matrix is resolved

- Do not generate auth/onboarding migration until `Lead.embedding` canonical type is decided.
- Do not merge PR #6 until `EmailActivityLog`, `EmailTrackedLink`, and `WaitlistRequest` are reviewed against this matrix.
- Do not apply any migration to live Supabase without explicit approval and evidence from a fresh read-only schema verifier run.
