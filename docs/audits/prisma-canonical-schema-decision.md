# Prisma Canonical Schema Decision

Last updated: 2026-06-18

Status: Superseded by architecture plan; no migrations modified.

## Decision

CraftMyFunnel should use one shared canonical Prisma schema for the shared production Postgres database.

Because `apps/web` and `apps/api` both read and write the same Supabase-backed application database, divergent Prisma schemas are a production risk. The canonical production schema should be maintained once, then consumed or mirrored by deployable services through a controlled process.

For the next migration planning step, use `apps/web/prisma/schema.prisma` as a temporary reference candidate because it contains the currently required Clerk/invite onboarding objects:

- `User.clerkUserId` mapped to `clerk_user_id`
- `UserInvitation`
- `InviteRequest` mapped to `invite_requests`
- `InvitationStatus`
- `InviteRequestStatus`
- expanded `UserRole` values used by the invite/admin flows

However, do not apply it as-is. The `Lead.embedding` type must be reconciled first because:

- `apps/web` currently models `Lead.embedding` as `Unsupported("vector(1536)")?`.
- `apps/api` models `Lead.embedding` as `String?`.
- The observed live DB column is nullable `text`.
- The vector extension is installed, but extension presence alone does not prove the column should be converted.

## Comparison Summary

Local diff from API schema to web schema shows the main semantic differences:

- Web adds Clerk identity mapping on `User`.
- Web adds invite request and user invitation models.
- Web expands `UserRole`.
- Web adds invitation enums.
- Web uses vector for `Lead.embedding`; API uses text/string.

Migration directory comparison:

- `apps/web/prisma/migrations`: 25 directories.
- `apps/api/prisma/migrations`: 22 directories.
- Web-only migrations:
  - `20260603120000_user_invitations`
  - `20260609090000_invite_requests`
  - `20260609110000_clerk_user_mapping`

## Updated Architecture Direction

Do not permanently make `apps/web` canonical. Move toward:

```text
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/
```

See `docs/audits/canonical-schema-architecture-plan.md`.

## Strategy

1. Treat the production DB as a shared contract.
2. Stop adding production migrations independently in both `apps/web` and `apps/api`.
3. Choose a single canonical schema source before generating further migrations.
4. Mirror generated Prisma client usage into each app only after canonical migration review.
5. Reconcile `Lead.embedding` before any production migration:
   - Option A: keep `text` for compatibility with live DB and current API runtime.
   - Option B: migrate to `vector(1536)` only with an explicit data conversion/backfill plan and query/runtime support.

Recommended immediate reference target:

- Temporary reference candidate: `apps/web/prisma/schema.prisma`
- Permanent target: `packages/db/prisma/schema.prisma`
- Required adjustment before migration generation: align `Lead.embedding` with the approved live-compatible type.
- Do not modify migration SQL in this pass.

## Risks

- Keeping divergent schemas can let one app generate a Prisma client that expects tables/columns the other app and live DB do not have.
- Applying web migrations as-is may include unsafe migration behavior from shared pending migration history.
- Converting `Lead.embedding` to vector without a data plan can break existing text data or application code that serializes embeddings as strings.

## Next Action

Create a follow-up PR that:

1. Confirms `apps/web` as canonical or moves schema to a shared package.
2. Makes `apps/api` consume the canonical schema/client generation path.
3. Resolves `Lead.embedding` type explicitly.
4. Generates only reviewed additive migrations after migration safety approval.
