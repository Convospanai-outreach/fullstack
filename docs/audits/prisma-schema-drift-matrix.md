# Prisma Schema Drift Matrix

Agent: prisma-drift-agent  
Phase: 4 - Prisma drift resolution  
Branch: `codex/db-linkage-swarm-orchestration`  
Last updated: 2026-06-18 (Post Phase 4 API Auth Sync Convergence)  

## Evidence sources

| Source | Evidence method | Notes |
| --- | --- | --- |
| `packages/db/prisma/schema.prisma` | Direct file inspection | Identical to `apps/web` and `apps/api`; sha256=`3d46e8b3…` |
| `apps/web/prisma/schema.prisma` | Direct file inspection | Identical to `packages/db` and `apps/api`; sha256=`3d46e8b3…` |
| `apps/api/prisma/schema.prisma` | Direct file inspection | Identical to `packages/db` and `apps/web`; sha256=`3d46e8b3…` |
| Live Supabase (`izqcycslipmbgdwgajvu`) | Prior read-only SQL inspection (prior swarm runs) | Not re-queried this session; prior findings recorded in `VERIFICATION_MATRIX.md` |

> Live Supabase evidence is from prior swarm runs. A fresh `npm run schema:verify:readonly` run against production must be done before any migration is drafted.

---

## Verdict key

| Verdict | Meaning |
| --- | --- |
| MATCH | Identical across all local schemas |
| RESOLVED | Drift that was active but is now completely resolved |
| LIVE_DRIFT | Schema differs from known live Supabase state (requires migration phase) |
| NOT_IN_EITHER | Not present in any local schema; may be in PR #6 or live only |

---

## Model-level presence matrix

| Model / Enum | packages/db | apps/web | apps/api | Live Supabase | Verdict |
| --- | --- | --- | --- | --- | --- |
| `Lead` | ✅ | ✅ | ✅ | ✅ (confirmed) | **RESOLVED** (Lead.embedding is String? across all local schemas) |
| `Email` | ✅ | ✅ | ✅ | ✅ (confirmed) | **MATCH** (field-level identical) |
| `ConnectedMailbox` | ✅ | ✅ | ✅ | ✅ (confirmed) | **MATCH** (field-level identical) |
| `EmailEvent` | ✅ | ✅ | ✅ | ✅ (confirmed) | **MATCH**; no `EmailActivityLog` in either local schema |
| `TrackedLink` | ✅ | ✅ | ✅ | NOT_CHECKED_LIVE | **MATCH** (field-level identical) |
| `SuppressionEntry` | ✅ | ✅ | ✅ | NOT_CHECKED_LIVE | **MATCH** (field-level identical) |
| `WaitlistRequest` | ❌ | ❌ | ❌ | NOT_CHECKED_LIVE | **NOT_IN_EITHER** (PR #6 proposes adding it) |
| `UserInvitation` | ✅ | ✅ | ✅ | ❌ (missing live) | **RESOLVED** (locally matched; LIVE_DRIFT remains) |
| `InviteRequest` | ✅ | ✅ | ✅ | NOT_CHECKED_LIVE | **RESOLVED** (locally matched; LIVE_DRIFT remains) |
| `InvitationStatus` (enum) | ✅ | ✅ | ✅ | NOT_CHECKED_LIVE | **RESOLVED** (locally matched) |
| `InviteRequestStatus` (enum) | ✅ | ✅ | ✅ | NOT_CHECKED_LIVE | **RESOLVED** (locally matched) |
| `User` | ✅ | ✅ | ✅ | ✅ (confirmed) | **RESOLVED** (clerkUserId and relations synced locally; LIVE_DRIFT remains) |
| `TeamMember` | ✅ | ✅ | ✅ | ✅ (confirmed) | **MATCH** |
| `EmailActivityLog` | ❌ | ❌ | ❌ | NOT_CHECKED_LIVE | **NOT_IN_EITHER** (PR #6 concern only) |
| `EmailTrackedLink` | ❌ | ❌ | ❌ | NOT_CHECKED_LIVE | **NOT_IN_EITHER** (PR #6 concern only) |

---

## Field-level drift detail

### Lead.embedding

| Source | Prisma type | Notes |
| --- | --- | --- |
| `packages/db` | `String?` | Controlled-beta canonical type: String/text (matches live DB) |
| `apps/web` | `String?` | Matches packages/db |
| `apps/api` | `String?` | Matches packages/db |
| Live Supabase | `text` (nullable) | Confirmed by prior read-only inspection |

**Verdict:** **RESOLVED**  
**Status:** Both schemas and packages/db have converged to Option B (`String?` / `text` equivalent). No type drift exists locally.
**Next steps:** When vector capabilities are needed, a separate future migration phase will upgrade this column to `Unsupported("vector(1536)")?`.

---

### User.clerkUserId

| Source | Field definition | Notes |
| --- | --- | --- |
| `packages/db` | `clerkUserId String? @unique @map("clerk_user_id")` | Synced |
| `apps/web` | `clerkUserId String? @unique @map("clerk_user_id")` | Synced |
| `apps/api` | `clerkUserId String? @unique @map("clerk_user_id")` | Synced |
| Live Supabase | **absent** (`clerk_user_id` column missing) | Confirmed by prior read-only inspection |

**Verdict:** **RESOLVED** locally; **LIVE_DRIFT** remains  
**Status:** Local schemas are fully synchronized. Live database lacks the column.
**Next steps:** Generate and apply a safe, additive migration (`ALTER TABLE "User" ADD COLUMN "clerk_user_id" TEXT`) before deploying code that depends on it.

---

### User — invite-related relations

| Source | Present | Relations |
| --- | --- | --- |
| `packages/db` / `apps/web` | ✅ | `sentInvitations UserInvitation[]`, `approvedInviteRequests InviteRequest[] @relation("InviteRequestApprovedBy")` |
| `apps/api` | ✅ | Synced relations exist |
| Live Supabase | ❌ | `UserInvitation` table confirmed missing live |

**Verdict:** **RESOLVED** locally; **LIVE_DRIFT** remains  
**Status:** Local schemas are fully synchronized. Live database lacks these tables.
**Next steps:** Generate and apply a safe, additive migration to create the tables `UserInvitation` and `invite_requests` and link relations.

---

### ConnectedMailbox — field naming

No naming differences exist in current local schemas. Both use `email`, `encryptedAccessToken`, `encryptedRefreshToken`, `tokenExpiresAt`, and `historyId`. Matches perfectly.

---

### Email — field-level

No field-level differences exist. Models are identical across all local schemas.

---

### EmailEvent vs EmailActivityLog

No duplication exists in the local schemas. `EmailActivityLog` does not exist in any canonical schema. This was a concern from PR #6 which was postponed/quarantined.

---

### TrackedLink vs EmailTrackedLink

No duplication exists. `EmailTrackedLink` does not exist in the canonical schemas.

---

### WaitlistRequest

Does not exist in any local schema.

---

### UserInvitation — field-level (local match)

Fully synchronized across `packages/db`, `apps/web`, and `apps/api`.
**Live status:** Confirmed missing from live database.

---

### InviteRequest — field-level (local match)

Fully synchronized across `packages/db`, `apps/web`, and `apps/api`.
**Live status:** Assumed missing from live database.

---

## Summary of Phase 4 accomplishments

1. **Embedding convergence**: All three local schemas have `Lead.embedding` typed as `String?`.
2. **Auth & invite schema sync**: Added `UserInvitation`, `InviteRequest`, `InvitationStatus`, `InviteRequestStatus`, and relations on `User` and `Team` to `apps/api/prisma/schema.prisma` in exact parity with `packages/db` and `apps/web`.
3. **Drift resolved**: Running `npm run db:schema:compare` yields a clean `MATCH` across all three pairs with 0 local drift.

## Next steps (Phase 5)

1. Connect to database in dev/staging to verify schemas.
2. Prepare additive migrations for Clerk/onboarding fields.
3. Keep dangerous migrations quarantined.
