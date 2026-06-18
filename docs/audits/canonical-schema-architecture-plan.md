# Canonical Schema Architecture Plan

Last updated: 2026-06-18

Status: Phase 1 plan only. No schema move, migration generation, or production DB change has been performed.

## Decision Direction

CraftMyFunnel should move toward a shared canonical database package:

```text
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/
packages/db/scripts/
```

`apps/web/prisma/schema.prisma` should not become the permanent source of truth. It remains the best short-term reference candidate only because it currently contains auth/onboarding objects that the web runtime expects and the API schema lacks. The long-term production contract should live outside deployable apps.

## Why A Shared Package

`apps/web` and `apps/api` target the same logical production Postgres database. Maintaining separate Prisma schemas lets services drift on:

- migration history
- generated client expectations
- auth/onboarding tables
- email/mailbox canonical tables
- vector/text column choices
- destructive migration safety posture

A shared package makes schema ownership explicit and reduces the risk that one service deploys against columns or tables missing from another service or from live Supabase.

## Proposed End State

| Concern | Proposed owner |
| --- | --- |
| Canonical Prisma schema | `packages/db/prisma/schema.prisma` |
| Canonical migrations | `packages/db/prisma/migrations/` |
| Read-only schema verifier | `scripts/db/verify-schema-readiness.mjs` initially, then optionally `packages/db/scripts/` |
| Migration manifest | `scripts/db/migration-manifest.schema.json` format, later enforced in CI |
| App Prisma client generation | web/API consume the shared package contract through documented scripts |

## Phase 1 Scope

This phase only prepares the architecture and safety gates:

1. Document the move toward `packages/db/prisma/schema.prisma`.
2. Keep `apps/web` as a temporary reference candidate, not a permanent owner.
3. Move read-only verification tooling out of `apps/web/src`.
4. Add production verification mode requirements.
5. Add migration manifest format without enforcement.

## Phase 2 Scope

Before any auth additive migration:

1. Create or approve the shared schema package shape.
2. Reconcile `Lead.embedding` as text or vector with a reviewed data plan.
3. Decide how `apps/web` and `apps/api` generate clients from the shared schema.
4. Quarantine and replace unsafe EdgeNode migration behavior without modifying the existing migration in place.
5. Generate draft additive auth/onboarding migration only after the above is accepted.

## Non-Goals For This Pass

- No production DB contact.
- No production migration.
- No auth migration generation.
- No modification of `20260604140000_edge_runtime_pairing` in place.
- No PR #6 merge or split implementation.
- No runtime health changes.

## Open Decisions

| Decision | Options | Current recommendation |
| --- | --- | --- |
| Schema package structure | `packages/db` workspace vs docs-only staging | Create `packages/db` in a focused follow-up PR |
| `Lead.embedding` type | live-compatible `text` vs `vector(1536)` | Decide before migration generation |
| Migration manifest enforcement | advisory docs vs CI gate | Advisory now, CI gate later |
| App-local schemas | keep copies vs remove after shared package | Remove or generate from shared package after migration path is stable |

## Safety Gate Before Phase 2

Phase 2 should not begin until:

1. The shared schema ownership plan is approved.
2. The migration manifest fields are accepted.
3. The read-only verifier is runnable from root tooling.
4. Vercel build failure from commit `3b2d7069ac839a5559fa729f28ab913954e52dea` is fixed.
