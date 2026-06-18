# Production Readiness Final

Last updated: 2026-06-18

Status: Not launch-ready.

## Summary

Vercel deployment evidence exists, and Supabase is active, but production readiness is blocked. Vercel `READY` is not sufficient: live DB schema, migration history, auth schema compatibility, env mapping, and CI status are not fully proven.

## Critical Blockers

1. Live Supabase has 17 Prisma migrations, while local web has 25 and API has 22.
2. Live DB is missing local web auth/onboarding objects: `User.clerk_user_id`, `UserInvitation`, and `invite_requests`.
3. Pending migration `20260604140000_edge_runtime_pairing` contains `DELETE FROM "EdgeNode"` and must not run in production as-is.
4. Vercel production/preview env-key and target mapping could not be verified.
5. Public readiness endpoint is not proven; current health routes rely on `SELECT 1`, which is insufficient.
6. GitHub Actions green status was not verified because `gh` is unavailable in this environment.
7. PR #6 is broad and must not be merged as-is.

## Implementation REPLAN d3086c0

Status: REPLAN completed; production remains blocked.

- REPLAN artifact: `docs/codex/IMPLEMENTATION_REPLAN_D3086C0.md`
- Canonical schema decision draft: `docs/audits/prisma-canonical-schema-decision.md`
- Unsafe migration quarantine: `docs/audits/unsafe-migration-quarantine.md`
- Auth/onboarding repair plan: `docs/audits/auth-schema-repair-plan.md`
- Read-only verifier: `apps/web/src/scripts/verify-schema-readiness.ts`
- Package entry point: `npm run schema:verify:readonly`

The canonical decision currently proposes one shared production Prisma schema because `apps/web` and `apps/api` point at the same logical production database. `apps/web/prisma/schema.prisma` is the canonical candidate because it contains the Clerk and invite objects required by web runtime, but it must not be applied as-is until `Lead.embedding` is reconciled.

The migration `20260604140000_edge_runtime_pairing` remains quarantined for production because it contains `DELETE FROM "EdgeNode"`. The replacement path must be preflight check, audit/backup if needed, non-destructive migration, and manual approval before any cleanup.

No production migration was run. No `prisma db push` was run. PR #6 was not merged.

## Evidence

- Branch updated: `codex/db-linkage-swarm-orchestration`
- Baseline branch commit inspected: `12174245a1af55d32c0b46a04b5d9f7b0a2948cd`
- Vercel project: `fullstack-web-xkxn` / `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8`
- Supabase project: `Fullstack2026` / `izqcycslipmbgdwgajvu`
- Supabase schema fingerprint: `c277e899b339aeb93d8dfaef77426b78`
- Public tables: 90
- Live Prisma migrations: 17
- Web local migrations: 25
- API local migrations: 22

## PR Strategy

- PR #2: keep as a small candidate after resolving mergeability and CI. It should not be treated as full readiness proof.
- PR #6: split before merge. Suggested slices: docs/runbooks, env/auth aliases, schema migration, Gmail runtime/API, UI/tests.

## Recommended Next Work

1. Approve or revise the canonical Prisma decision before generating migrations.
2. Prepare a reviewed replacement for the quarantined EdgeNode migration path.
3. Generate an additive auth/onboarding draft migration after canonical schema approval.
4. Run the read-only schema verifier with approved expected values against the intended database.
5. Verify Vercel env keys/targets without exposing values.
6. Re-run GitHub Actions and require green checks before launch.
