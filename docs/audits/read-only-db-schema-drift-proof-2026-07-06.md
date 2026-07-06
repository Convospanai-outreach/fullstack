# Read-only DB Schema Drift Proof

## Scope

Evidence-only DB/schema/migration drift proof after production health turned green.

## Safety Constraints

- No DB mutation was performed.
- No migrations were applied.
- No `prisma db push` was run.
- No secrets were printed.
- No env values were changed.
- This audit does not claim full production readiness.

## Baseline

- Current branch: `docs/read-only-db-schema-drift-proof-2026-07-06`
- Base main SHA: `8f01d47b81de63327eecd2c95d63c0ea8c7a3a43`
- Latest production health proof reference: `docs/audits/production-health-green-proof-2026-07-06.md`

## Prisma Schema Inventory

| Schema file | Exists | Datasource provider | Generator settings | Notable auth/onboarding/mailbox/runtime models | Alignment assessment |
| --- | --- | --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | Yes | `postgresql` | `prisma-client-js`, `engineType = "library"` | `User`, `Team`, `TeamMember`, `UserInvitation`, `InviteRequest` (`@@map("invite_requests")`), `ConnectedMailbox`, `EdgeNode`, `Lead`, `Campaign` | Matches `apps/web` and `apps/api` exactly in the current local tree |
| `apps/web/prisma/schema.prisma` | Yes | `postgresql` | `prisma-client-js`, `engineType = "library"` | `User`, `Team`, `TeamMember`, `UserInvitation`, `InviteRequest` (`@@map("invite_requests")`), `ConnectedMailbox`, `EdgeNode`, `Lead`, `Campaign` | Matches `packages/db` and `apps/api` exactly in the current local tree |
| `apps/api/prisma/schema.prisma` | Yes | `postgresql` | `prisma-client-js`, `engineType = "library"` | `User`, `Team`, `TeamMember`, `UserInvitation`, `InviteRequest` (`@@map("invite_requests")`), `ConnectedMailbox`, `EdgeNode`, `Lead`, `Campaign` | Matches `packages/db` and `apps/web` exactly in the current local tree |

`npm run db:schema:compare` confirmed all three schemas are byte-for-byte identical in the local repository snapshot used for this audit.

## Migration Inventory

| Area | Migration count | Latest migration name | Destructive SQL found | `20260604140000_edge_runtime_pairing` present | Notes |
| --- | --- | --- | --- | --- | --- |
| `packages/db/prisma/migrations` | `0` | `NONE` | No local SQL files present | No local migration directory present | Intended shared schema location exists without an owned migration history |
| `apps/web/prisma/migrations` | `25` | `20260614173000_add_llm_usage_actor` | Yes | Yes | Contains extra auth/onboarding migrations not present in API history |
| `apps/api/prisma/migrations` | `22` | `20260614173000_add_llm_usage_actor` | Yes | Yes | Migration history is shorter than web and diverges on auth/onboarding coverage |

Migration histories are duplicated and divergent even though the three current schema files now match locally.

## Known Risk Areas

- `20260604140000_edge_runtime_pairing` remains present in both `apps/web/prisma/migrations` and `apps/api/prisma/migrations`.
- `DELETE FROM "EdgeNode"` was found inside the `edge_runtime_pairing` migration SQL. This is still a destructive path in local migration history.
- `User.clerk_user_id` is present in the current local Prisma schemas via `clerkUserId @map("clerk_user_id")`, but live DB proof was not re-established in this stage because no safe read-only DB URL was available in the shell.
- `UserInvitation` is present in all three local Prisma schemas, but live DB proof was not re-established in this stage.
- `invite_requests` is present in all three local Prisma schemas through `InviteRequest @@map("invite_requests")`, but live DB proof was not re-established in this stage.
- `ConnectedMailbox` is present in all three local Prisma schemas and no current local naming drift was found, but live DB proof was not re-established in this stage.
- Auth/onboarding assumptions remain risky because the local schema inventory is aligned while the live DB shape was not safely re-queried in this audit.
- `packages/db`, `apps/web`, and `apps/api` now share the same schema file content, but their migration ownership/history is not unified.

## Read-only Command Results

| Command | Result | Safe summarized output |
| --- | --- | --- |
| `npm run db:schema:compare` | PASS | Reported all three Prisma schema files as exact matches with the same line count and the same SHA-256 fingerprint |
| `npm run schema:verify:readonly` | BLOCKED_SAFE_INPUT_REQUIRED | Script exited because `SCHEMA_VERIFY_DATABASE_URL`, `DATABASE_URL`, or `DIRECT_URL` was not available in the shell; no workaround attempted |
| `npm run readiness:audit --workspace apps/api` | NOT_RUN_SAFETY | `apps/api/package.json` routes this through `readiness:seed`, and `apps/api/src/scripts/seed-readiness.ts` performs DB writes (`upsert`, `create`, `update`) |

## Findings

- GREEN: Current local Prisma schema files are aligned across `packages/db`, `apps/web`, and `apps/api`.
- YELLOW: Live DB shape, migration count, and schema fingerprint were not re-proven in this stage because safe read-only DB credentials were unavailable in the shell.
- RED: Local migration histories remain duplicated/divergent across web and API.
- RED: The destructive `DELETE FROM "EdgeNode"` path still exists in `20260604140000_edge_runtime_pairing` in both app-local migration trees.
- YELLOW: `apps/api` readiness audit is not usable as evidence for this stage because it seeds data before validating.

## Verdict

RED:
Unsafe/destructive migration path or confirmed schema mismatch blocks production readiness.

Rationale:

- The local schema files now align, but migration ownership is still split across multiple trees.
- A destructive `DELETE FROM "EdgeNode"` path remains in committed migration SQL.
- Safe live DB verification could not be completed from this shell because no read-only DB URL was available.

## Next Action

- Create a non-destructive migration plan PR that formally resolves migration ownership and quarantines or replaces the destructive `EdgeNode` path.
- Resolve the canonical schema and canonical migration source-of-truth decision operationally, not only at file-content level.
- Re-run live DB shape verification with safe read-only credentials only.
- Split PR #6 before any merge.
- Proceed to Clerk/app DB linkage proof only after schema drift and migration ownership are understood.

## Not Included

This audit does not prove:

- full auth flows
- Clerk user/team creation
- Redis behavior
- PR #6 safety
- full production readiness
- controlled beta readiness
