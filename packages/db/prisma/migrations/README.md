# Migration Ownership

`packages/db/prisma/schema.prisma` is the canonical schema (2026-09-11: reconciled
onto `apps/api`'s copy, which matched production; `apps/web` and `packages/db`
were previously stale — see `node scripts/db/compare-prisma-schemas.mjs`). This
directory is kept as a full, up-to-date mirror of both apps' migration history.

Current status:

- `packages/db/prisma/schema.prisma` and `prisma/migrations/` mirror `apps/api`'s
  (the ones actually applied to the shared production DB).
- App-local schemas (`apps/web`, `apps/api`) remain in place and must stay
  byte-identical to this one — verified by `node scripts/db/compare-prisma-schemas.mjs`,
  which is a CI gate (`.github/workflows/ci.yml`).
- No app generates its Prisma Client from this package directly yet; each app
  still runs its own `prisma generate` from its own (now-synced) local schema.
- Production migrations are still applied per-app (apps/web via the
  `Web Prisma Migrate` workflow, apps/api via `docker compose run --rm api
  npx prisma migrate deploy` on the Oracle VMs, per
  `docs/deployment/oracle-vm-deployment.md`) — this package is the source you
  edit, not a new deploy target.

**Workflow for any future schema change:**

1. Edit `packages/db/prisma/schema.prisma`.
2. Add the matching migration folder here, AND copy it (same folder name) into
   both `apps/web/prisma/migrations/` and `apps/api/prisma/migrations/`.
3. Run `node scripts/db/sync-prisma-schema.mjs` to propagate the schema file to
   both apps.
4. Run `node scripts/db/compare-prisma-schemas.mjs` and confirm all three MATCH
   before committing — CI will reject a mismatch either way.

Guardrails:

- Do not use `prisma db push` against production.
- Do not run production migrations until the canonical migration plan is approved.
- Do not modify unsafe existing migrations in place.
- Do not include destructive SQL without preflight evidence, backup/audit plan, and manual approval.
- The `20260604140000_edge_runtime_pairing` migration has been rewritten to include a safe pre-constraint orphan audit/backup/delete sequence.

Future migration PRs should include:

- updated `packages/db/prisma/schema.prisma`
- reviewed migration SQL under this directory
- migration manifest evidence
- read-only schema verifier output
- explicit note that app-local schema drift has been checked (`node scripts/db/compare-prisma-schemas.mjs`)
