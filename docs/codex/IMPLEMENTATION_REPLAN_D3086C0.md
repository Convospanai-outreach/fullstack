# Implementation Replan From d3086c0

Last updated: 2026-06-18

Baseline observation commit: `d3086c094d145eed0b7f5a5c7eed495bd302fb19`

Target branch: `codex/db-linkage-swarm-orchestration`

## Guardrails

- Do not run production migrations yet.
- Do not run `prisma db push` against production.
- Do not delete production data.
- Do not expose secrets.
- Do not merge PR #6 as-is.
- Treat Vercel `READY` and `SELECT 1` as insufficient readiness proof.

## PLAN

Start implementation by converting the observed blockers into reviewable planning artifacts and a non-mutating verification script.

Scope for this pass:

1. Decide the canonical production Prisma schema strategy.
2. Quarantine unsafe migration `20260604140000_edge_runtime_pairing`.
3. Prepare an additive auth/onboarding schema repair plan.
4. Add a read-only schema verification script and package script.
5. Update workflow, verification, and readiness docs.

Out of scope:

- Applying migrations.
- Editing existing migration SQL.
- Changing application runtime logic.
- Merging or modifying PR #6.
- Connecting to or mutating the production database.

## CHECK

Inputs from `WORKFLOW_STATE.md` and `production-readiness-final.md`:

- Live Supabase has 17 Prisma migrations.
- Local `apps/web` has 25 migration directories.
- Local `apps/api` has 22 migration directories.
- Live DB is missing `User.clerk_user_id`, `UserInvitation`, and `invite_requests`.
- Pending migration `20260604140000_edge_runtime_pairing` contains `DELETE FROM "EdgeNode"`.
- Vercel env-key/target mapping and GitHub Actions green status remain unverified.
- PR #6 is broad and must not merge as-is.

Local schema comparison:

- `apps/web/prisma/schema.prisma` includes the Clerk/invite onboarding models/fields absent from `apps/api`.
- `apps/api/prisma/schema.prisma` has `Lead.embedding` as `String?`, which matches the observed live `text` column.
- Both apps point at the same shared Postgres database shape and should not maintain divergent production Prisma schemas.

## ACT

Implementation actions in this pass:

- Create `docs/audits/prisma-canonical-schema-decision.md`.
- Create `docs/audits/unsafe-migration-quarantine.md`.
- Create `docs/audits/auth-schema-repair-plan.md`.
- Add `apps/web/src/scripts/verify-schema-readiness.ts`.
- Add a package script for read-only schema verification.
- Update workflow/readiness docs with the replan status.

## REPLAN

Next implementation pass should happen only after review of these artifacts:

1. Approve canonical schema ownership.
2. Decide how to split unsafe `EdgeNode` cleanup from the additive migration.
3. Generate a draft additive auth/onboarding migration from the canonical schema.
4. Run the read-only verifier against a non-production or explicitly approved target.
5. Wire CI only after the verifier and expected values are agreed.

Status: `READY_FOR_NEXT_STAGE`

Files planned:

- `docs/codex/IMPLEMENTATION_REPLAN_D3086C0.md`
- `docs/audits/prisma-canonical-schema-decision.md`
- `docs/audits/unsafe-migration-quarantine.md`
- `docs/audits/auth-schema-repair-plan.md`
- `apps/web/src/scripts/verify-schema-readiness.ts`
- `apps/web/package.json`
- `package.json`
- `docs/codex/WORKFLOW_STATE.md`
- `docs/codex/VERIFICATION_MATRIX.md`
- `docs/audits/production-readiness-final.md`
