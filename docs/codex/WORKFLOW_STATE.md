# Codex Workflow State

This file is the source of truth for current task status. Update it after every agent stage.

## Current status

| Field | Value |
| --- | --- |
| Overall status | IN_PROGRESS |
| Current stage | Phase 4 - Prisma drift resolution |
| Current agent | prisma-drift-agent |
| Working branch | codex/db-linkage-swarm-orchestration |
| Baseline commit inspected | 07d6736f72989a1db8e854ee38c793cc9fb437a2 |
| Phase 3 commit | fc500fa7b4735c5ce8809c0dda5ead10f426759b |
| Last updated | 2026-06-18 |
| Next action | Run prisma-drift-agent: produce four-way drift matrix for all contested models across packages/db, apps/web, apps/api, and known live Supabase evidence |

## Status values

Use only these values:

- NOT_STARTED
- IN_PROGRESS
- READY_FOR_NEXT_STAGE
- NEEDS_REPLAN
- BLOCKED
- BLOCKED_EXTERNAL_ACCESS
- BLOCKED_BY_SCHEMA_CONFLICT
- BLOCKED_BY_FAILED_TESTS
- CONTROLLED_BETA_READY
- PRODUCTION_READY

## Active blockers

| Blocker | Owner agent | Evidence | Next action | Status |
| --- | --- | --- | --- | --- |
| Live DB behind local Prisma migrations | prisma-drift-agent | Supabase `_prisma_migrations` has 17 rows; local web has 25 migration dirs; local API has 22 migration dirs | Choose canonical Prisma source and migration plan | BLOCKED_BY_SCHEMA_CONFLICT |
| Live DB missing Clerk/invite schema used by web auth | auth-tenant-agent | Live DB lacks `User.clerk_user_id`, `UserInvitation`, and `invite_requests`; `apps/web/src/lib/clerkAuth.ts` depends on those objects | Apply reviewed non-destructive migrations or deploy code matching live schema | BLOCKED_BY_SCHEMA_CONFLICT |
| Pending migration contains destructive delete | migration-safety-agent | `20260604140000_edge_runtime_pairing` contains `DELETE FROM "EdgeNode"` | Split into audited preflight/backup/review before production migration | BLOCKED |
| Vercel env-key/target mapping unverified | env-guard-agent | Vercel connector did not expose env listing; local Vercel CLI scope failed | Verify env keys/targets without exposing values | BLOCKED_EXTERNAL_ACCESS |
| GitHub Actions green status unverified | ci-gate-agent | `gh` CLI unavailable in environment | Verify checks on target branch before launch | BLOCKED_EXTERNAL_ACCESS |
| PR #6 must not merge as-is | pr-strategy-agent | PR #6 is broad, mergeable=false, and overlaps schema/env/docs/runtime concerns | Split PR #6 into reviewable slices | BLOCKED_BY_SCHEMA_CONFLICT |

## Stage tracker

| Stage | Agent | Status | Evidence file | Notes |
| --- | --- | --- | --- | --- |
| 0. Branch and baseline | orchestrator | READY_FOR_NEXT_STAGE | WORKFLOW_STATE.md | Branch `codex/db-linkage-swarm-orchestration`, baseline `12174245a1af55d32c0b46a04b5d9f7b0a2948cd` |
| 1. Repo cartography | repo-cartographer | READY_FOR_NEXT_STAGE | WORKFLOW_STATE.md | Apps: web/API/edge-fastapi; web/API Prisma schemas; CI workflows mapped |
| 2. Vercel linkage inspection | vercel-linkage-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | Project/deployment found; env mapping not verified |
| 3. Supabase live schema inspection | supabase-inspector | NEEDS_REPLAN | VERIFICATION_MATRIX.md | Active project found; live schema drift found |
| 4. Prisma ownership and drift | prisma-drift-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | web/API schemas validate but histories diverge |
| 5. Gmail/mailbox conflict resolution | prisma-drift-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | PR #6 conflicts with canonical schema strategy |
| 6. Migration safety | migration-safety-agent | BLOCKED | VERIFICATION_MATRIX.md | Destructive `DELETE FROM "EdgeNode"` found |
| 7. Runtime DB alignment | runtime-db-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | App health checks still rely on `SELECT 1` |
| 8. Env linkage guards | env-guard-agent | BLOCKED_EXTERNAL_ACCESS | VERIFICATION_MATRIX.md | Vercel env-key/target proof unavailable |
| 9. Health and smoke tests | health-smoke-agent | NEEDS_REPLAN | VERIFICATION_MATRIX.md | Vercel logs show `/` and `/login` 200; readiness endpoint not proven |
| 10. Clerk/app DB linkage | auth-tenant-agent | BLOCKED_BY_SCHEMA_CONFLICT | production-readiness-final.md | Clerk sync depends on missing live DB objects |
| 11. Redis/cache/queue isolation | redis-cache-agent | READY_FOR_NEXT_STAGE | production-readiness-final.md | Redis degrades gracefully; production Redis env still unverified |
| 12. CI and PR strategy | ci-gate-agent | NEEDS_REPLAN | production-readiness-final.md | CI structure exists; live Actions green not verified |
| 13. Final readiness | release-readiness-agent | NEEDS_REPLAN | production-readiness-final.md | Final status: not launch-ready |
| Implementation REPLAN d3086c0 | orchestrator | READY_FOR_NEXT_STAGE | IMPLEMENTATION_REPLAN_D3086C0.md | Produced canonical schema decision, unsafe migration quarantine, auth repair plan, and read-only schema verifier |
| Phase 1. Canonical schema architecture | orchestrator | READY_FOR_NEXT_STAGE | canonical-schema-architecture-plan.md | Moves target ownership toward `packages/db/prisma/schema.prisma`; `apps/web` remains temporary reference only |
| Phase 2. Migration safety gates | migration-safety-agent | READY_FOR_NEXT_STAGE | migration-manifest-format.md | Added advisory manifest format and root read-only verifier; unsafe EdgeNode migration not modified |
| Phase 3. Shared DB package skeleton | orchestrator | READY_FOR_NEXT_STAGE | packages/db/package.json | Added skeleton package, copied web schema as starting snapshot, added migration ownership README and schema compare gate script |
| Phase 4. Prisma drift resolution | prisma-drift-agent | IN_PROGRESS | docs/audits/prisma-schema-drift-matrix.md, docs/audits/schema-compare-output.md | Four-way matrix complete. Key findings: Lead.embedding TYPE_DRIFT (web=vector(1536), api=String, live=text); User.clerkUserId WEB_ONLY/LIVE_DRIFT; UserInvitation+InviteRequest WEB_ONLY/API_MISSING/LIVE_DRIFT; ConnectedMailbox/Email/SuppressionEntry/TrackedLink identical; EmailActivityLog+EmailTrackedLink+WaitlistRequest NOT_IN_EITHER (PR #6 only) |

## Latest findings

- Vercel project `fullstack-web-xkxn` / `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` is linked to `Convospanai-outreach/fullstack`.
- Latest Vercel deployment inspected was `READY` from `codex/db-linkage-swarm-orchestration`; recent production deployments from `main` were also `READY`, but readiness is not proven by deploy state.
- Supabase project `Fullstack2026` / `izqcycslipmbgdwgajvu` is `ACTIVE_HEALTHY` on Postgres 17.
- Live Supabase schema fingerprint: `c277e899b339aeb93d8dfaef77426b78`.
- Live DB has 90 public tables and 17 Prisma migration rows.
- Local migration directories exceed live: web 25, API 22.
- Live DB is missing `User.clerk_user_id`, `UserInvitation`, and `invite_requests`, while web Clerk auth depends on them.
- `Lead.embedding` is nullable `text` live; vector extension is installed.
- `20260604140000_edge_runtime_pairing` includes `DELETE FROM "EdgeNode"` and must not run in production as-is.
- Vercel runtime logs showed recent production `200` responses for `/` and `/login`; local DNS maps custom domains to `127.0.0.1`, so direct local smoke checks were not reliable.
- PR #2 is focused but `mergeable=false`; PR #6 is broad, `mergeable=false`, and must be split.
- Implementation REPLAN from commit `d3086c094d145eed0b7f5a5c7eed495bd302fb19` is documented in `docs/codex/IMPLEMENTATION_REPLAN_D3086C0.md`.
- Shared production DB should use a single canonical Prisma schema; `apps/web/prisma/schema.prisma` is only a temporary reference candidate while the architecture moves toward `packages/db/prisma/schema.prisma`.
- Unsafe migration `20260604140000_edge_runtime_pairing` is quarantined for production because it deletes orphaned `EdgeNode` rows.
- Additive auth/onboarding repair is planned for `User.clerk_user_id`, `UserInvitation`, and `invite_requests`; no production migration has been generated or applied.
- Vercel deployment for commit `3b2d7069ac839a5559fa729f28ab913954e52dea` failed because Next.js typechecked `apps/web/src/scripts/verify-schema-readiness.ts` and the repo lacks `@types/pg`.
- The read-only verifier has moved to `scripts/db/verify-schema-readiness.mjs`; `apps/web/src/scripts/verify-schema-readiness.ts` was removed so Vercel does not typecheck it as app code.
- Root scripts now expose `npm run schema:verify:readonly` and `npm run schema:verify:production`.
- Production verifier mode requires expected migration count, latest migration, schema fingerprint, and either expected migration names or a manifest path.
- Migration manifest format exists at `scripts/db/migration-manifest.schema.json`; it is not enforced yet.
- Vercel deployment `dpl_8dfuT5xwLDeoHfdxQfeuqh6qTFGU` for commit `07d6736f72989a1db8e854ee38c793cc9fb437a2` is `READY`.
- Vercel build for Phase 3 commit `fc500fa7b4735c5ce8809c0dda5ead10f426759b` confirmed `READY` by user on 2026-06-18.
- Shared DB package skeleton now exists at `packages/db`.
- `packages/db/prisma/schema.prisma` is a starting snapshot copied from `apps/web/prisma/schema.prisma`; app-local schemas were not deleted or rewired.
- Schema comparison is available with `npm run db:schema:compare`; it exits non-zero on current API drift and is not wired into CI.
- Live compare output (2026-06-18): `packages/db` matches `apps/web` (MATCH); `apps/api` differs by `InviteRequest`, `UserInvitation`, `InvitationStatus`, `InviteRequestStatus` (DIFFER, expected known drift).
- Phase 4 drift matrix completed (2026-06-18): `ConnectedMailbox` naming conflicts do NOT exist in current local schemas (PR #6 concern only). `Email`, `SuppressionEntry`, `TrackedLink` are field-for-field identical across web and API. `EmailActivityLog`, `EmailTrackedLink`, `WaitlistRequest` do not exist in any local schema (PR #6 proposals only).
- `Lead.embedding` TYPE_DRIFT confirmed: web/packages=`Unsupported("vector(1536)")?`, API=`String?` (comment: "Temporarily String to match DB state"), live=`text` nullable.
- `User.clerkUserId` (`clerk_user_id`) is present in `apps/web` and `packages/db`, absent from `apps/api` User model, and absent from live Supabase.
- `UserInvitation` model present in web/packages, absent from `apps/api`, confirmed absent from live Supabase.
- `InviteRequest` model (mapped to `invite_requests`) present in web/packages, absent from `apps/api`, live state not confirmed this session.
- See `docs/audits/prisma-schema-drift-matrix.md` for full evidence and `docs/audits/schema-compare-output.md` for raw compare output.

## Decisions

| Decision | Date | Agent | Evidence | Status |
| --- | --- | --- | --- | --- |
| Vercel READY is insufficient | 2026-06-18 | orchestrator | Deployment metadata and runtime/db blockers | ACCEPTED |
| SELECT 1 is insufficient | 2026-06-18 | runtime-db-agent | Health routes only check `SELECT 1`; schema drift exists | ACCEPTED |
| Do not run production migrations yet | 2026-06-18 | migration-safety-agent | Pending migration contains destructive delete | ACCEPTED |
| Do not merge PR #6 as-is | 2026-06-18 | pr-strategy-agent | PR #6 broad/conflicting diff | ACCEPTED |
| Shared production DB requires one canonical Prisma schema | 2026-06-18 | orchestrator | `docs/audits/prisma-canonical-schema-decision.md` | PROPOSED |
| Quarantine `20260604140000_edge_runtime_pairing` before production deploy | 2026-06-18 | migration-safety-agent | `docs/audits/unsafe-migration-quarantine.md` | ACCEPTED |
| Auth/onboarding repair must be additive and review-gated | 2026-06-18 | auth-tenant-agent | `docs/audits/auth-schema-repair-plan.md` | ACCEPTED |
| Permanent canonical schema target should be `packages/db/prisma/schema.prisma`, not `apps/web` | 2026-06-18 | orchestrator | `docs/audits/canonical-schema-architecture-plan.md` | PROPOSED |
| Migration manifest format is advisory only until explicitly enforced | 2026-06-18 | migration-safety-agent | `scripts/db/migration-manifest.schema.json` | ACCEPTED |
| `Lead.embedding` canonical type | Choose vector(1536) vs String vs leave as live text | 2026-06-18 | prisma-drift-agent | Phase 4 drift matrix evidence | NEEDS_DECISION |
| `ConnectedMailbox` naming conflicts | No conflict in current local schemas | 2026-06-18 | prisma-drift-agent | Direct schema inspection | RESOLVED |
| `EmailActivityLog` / `EmailTrackedLink` / `WaitlistRequest` | Not in any current local schema; PR #6 proposals only | 2026-06-18 | prisma-drift-agent | Direct schema inspection | RESOLVED |
| `UserInvitation` + `InviteRequest` API gap | Must be added to `apps/api` and applied to live DB | 2026-06-18 | prisma-drift-agent | Phase 4 drift matrix | ACCEPTED — blocked on auth-tenant-agent execution |

## Next action queue

1. [ACTIVE - Phase 4] Decide canonical type for `Lead.embedding`: vector(1536), String, or deferred migration — update `packages/db` schema once decided.
2. [ACTIVE - Phase 4] Add `User.clerkUserId` to `apps/api` User model (no migration yet; schema sync only).
3. [ACTIVE - Phase 4] Add `UserInvitation`, `InviteRequest`, `InvitationStatus`, `InviteRequestStatus` to `apps/api` schema (no migration yet).
4. [QUEUED] Run `npm run schema:verify:readonly` against live DB (requires env access) to confirm fresh live state before any migration.
5. [QUEUED] Generate additive auth migration for `clerk_user_id`, `UserInvitation`, `invite_requests` after schema decision is approved.
6. [QUEUED] Replace the quarantined `20260604140000_edge_runtime_pairing` production path with reviewed preflight, non-destructive migration, and manual cleanup approval.
7. [QUEUED] Decide whether the advisory migration manifest should become a CI gate.
8. [QUEUED] Verify Vercel env keys and targets without exposing values.
9. [QUEUED] Verify GitHub Actions are green on the target branch.
10. [QUEUED] Split PR #6 later, after schema and runtime readiness strategy is stable.

## Handoff note template

| Field | Value |
| --- | --- |
| From agent |  |
| To agent |  |
| Stage completed |  |
| Status |  |
| Files changed |  |
| Evidence |  |
| Known risks |  |
| Next action |  |
| Stop conditions |  |
