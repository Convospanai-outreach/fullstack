# Codex Workflow State

This file is the source of truth for current task status. Update it after every agent stage.

## Current status

| Field | Value |
| --- | --- |
| Overall status | NEEDS_REPLAN |
| Current stage | Phase 1/2 - Canonical schema architecture and migration safety gates |
| Current agent | orchestrator |
| Working branch | codex/db-linkage-swarm-orchestration |
| Baseline commit inspected | 3b2d7069ac839a5559fa729f28ab913954e52dea |
| Last updated | 2026-06-18 |
| Next action | Review shared `packages/db/prisma/schema.prisma` architecture and migration manifest before auth migration planning |

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

## Next action queue

1. Approve or revise `docs/audits/canonical-schema-architecture-plan.md`.
2. Create the shared `packages/db/prisma/schema.prisma` structure in a focused follow-up after approval.
3. Replace the quarantined `20260604140000_edge_runtime_pairing` production path with reviewed preflight, audit/backup, non-destructive migration, and manual cleanup approval.
4. Decide whether the advisory migration manifest should become a CI gate.
5. Generate a draft additive auth/onboarding migration only after the shared schema decision is approved.
6. Run `npm run schema:verify:readonly` against the intended database using redacted env handling; production mode requires approved expected values.
7. Verify Vercel env keys and targets without exposing values.
8. Resolve Clerk/invite schema mismatch before auth smoke.
9. Verify GitHub Actions are green on the target branch.
10. Split PR #6 later, after schema and runtime readiness strategy is stable.

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
