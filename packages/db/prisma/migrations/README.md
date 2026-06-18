# Migration Ownership

This directory is the planned home for canonical Prisma migrations once the shared DB package is approved as the source of truth.

Current status:

- `packages/db/prisma/schema.prisma` is a starting snapshot copied from `apps/web/prisma/schema.prisma`.
- App-local schemas remain in place.
- App-local migrations remain in place.
- No services are wired to this package yet.
- No production migrations should be run from this directory yet.

Guardrails:

- Do not use `prisma db push` against production.
- Do not run production migrations until the canonical migration plan is approved.
- Do not modify unsafe existing migrations in place.
- Do not include destructive SQL without preflight evidence, backup/audit plan, and manual approval.
- Keep `20260604140000_edge_runtime_pairing` quarantined until a safe replacement sequence is reviewed.

Future migration PRs should include:

- updated `packages/db/prisma/schema.prisma`
- reviewed migration SQL under this directory
- migration manifest evidence
- read-only schema verifier output
- explicit note that app-local schema drift has been checked
