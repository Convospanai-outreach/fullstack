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

1. Choose canonical Prisma source for production.
2. Split unsafe/destructive migration behavior into audited preflight plus approved migration.
3. Apply only reviewed, non-destructive migrations through `prisma migrate deploy`, never `db push`.
4. Verify live DB migrations, required tables/columns, app environment marker, and schema fingerprint.
5. Verify Vercel env keys/targets without exposing values.
6. Re-run GitHub Actions and require green checks before launch.
