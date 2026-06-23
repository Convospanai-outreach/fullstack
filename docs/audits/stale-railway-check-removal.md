# Stale Railway Check Cleanup Audit

Date: 2026-06-23
Issue: #38
Repository: `Convospanai-outreach/fullstack`
Branch: `codex/stale-railway-check-cleanup-plan`

## Scope

This audit verifies the GitHub/Railway status state after the stale Railway project `illustrious-warmth` was reportedly handled in the Railway dashboard. It does not change Railway, GitHub branch protection, Vercel, Supabase, Clerk, Redis, secrets, environment variables, DB schema, migrations, or production data.

## Latest Main Inspected

Latest `origin/main` inspected:

```text
bbd3d472f64ccc9c6ca52be50ddc651bd33d6e73
Merge PR #37: codex/post-pr35-merge-release-gate
```

## Workflow And Status Evidence

GitHub combined commit status for `bbd3d472f64ccc9c6ca52be50ddc651bd33d6e73` returned overall `failure`.

| Context | State | Classification | Notes |
| --- | --- | --- | --- |
| `illustrious-warmth - convospan-api-split` | success | Stale Railway project | `No deployment needed - watched paths not modified`; should not be required for release checks. |
| `illustrious-warmth - convospan-full-scaffold` | failure | Stale Railway project | `Deployment failed`; this stale duplicate context is still present on the latest inspected main commit. |
| `airy-balance - convospan-api-split` | success | Active Railway project | Active/canonical Railway API service context. |
| `airy-balance - convospan-full-scaffold` | success | Active Railway project | Active/canonical Railway full scaffold service context. |
| `Vercel` | success | Active Vercel deployment | Vercel status completed. |

GitHub check-runs for the same commit included:

| Check run | Conclusion | Notes |
| --- | --- | --- |
| `Web Build (apps/web)` | success | Main CI web build passed. |
| `API Strict Typecheck (apps/api)` | success | Main CI API typecheck/build/test path passed. |
| `Docker Build Smoke (api required, edge-fastapi optional)` | success | CI Docker smoke passed. |
| `Production Stability Audit (apps/web)` | success | Production Readiness Gate web audit passed. |
| `vercel-parity-build` | success | Vercel parity workflow passed. |
| `Verify Phi-3 Safety Enforcement` | success | Phi-3 verification passed. |
| `Supabase Preview` | success | Supabase check completed successfully. |
| `Analyze (actions)` | success | CodeQL completed. |
| `Analyze (javascript-typescript)` | success | CodeQL completed. |
| `Analyze (python)` | success | CodeQL completed. |
| `build-and-push` | failure | `Register Docker Images to GHCR`; web image build succeeded, then Trivy scanner failed. |

## Railway Cleanup Finding

`airy-balance` is the active Railway project and should remain the canonical Railway context family:

- `airy-balance - convospan-api-split`
- `airy-balance - convospan-full-scaffold`

`illustrious-warmth` is stale/duplicate and should not appear in required release checks:

- `illustrious-warmth - convospan-api-split`
- `illustrious-warmth - convospan-full-scaffold`

Historical commit statuses can remain visible on old commits even after dashboard cleanup. However, the latest inspected `main` commit `bbd3d472f64ccc9c6ca52be50ddc651bd33d6e73` still received `illustrious-warmth` statuses, so the stale deploy trigger or required-check configuration is not proven clean from GitHub evidence alone.

## Branch Protection Access

Attempted unauthenticated GitHub REST reads:

```text
GET /repos/Convospanai-outreach/fullstack/branches/main/protection
GET /repos/Convospanai-outreach/fullstack/branches/main/protection/required_status_checks
```

Result:

```text
401 Unauthorized
```

Branch protection required checks could not be read or changed from the available tooling.

## Manual GitHub UI Steps

Use GitHub UI with repository admin permissions:

```text
Repo Settings > Branches > main > Branch protection rule > Required status checks
```

Remove stale required checks if present:

- `illustrious-warmth - convospan-api-split`
- `illustrious-warmth - convospan-full-scaffold`

Keep active required checks only if intended release gates:

- `airy-balance - convospan-api-split`
- `airy-balance - convospan-full-scaffold`
- `Vercel`
- `CI / Web Build (apps/web)`
- `CI / API Strict Typecheck (apps/api)`
- `Production Readiness Gate / Production Stability Audit (apps/web)`
- `Vercel Parity Build / vercel-parity-build`
- CodeQL checks
- `Supabase Preview`
- `Register Docker Images to GHCR / build-and-push`, only if GHCR publishing is required for release

## GHCR Policy Note

PR #37 proved the web Docker image build in a PR-safe no-push workflow. On latest `main`, `Register Docker Images to GHCR / build-and-push` failed after the web image build succeeded, specifically at `Run Trivy vulnerability scanner on Web`. Therefore:

- The original `nodemailer` Docker build blocker is resolved.
- GHCR publishing is still not green on latest `main`.
- Treat GHCR as a required release gate only if image publication is mandatory for release.
- If GHCR is required, the next work item is Trivy finding triage/remediation, not another nodemailer/workspace dependency fix.

## Validation

Validation commands for this docs-only PR:

| Command | Result | Duration | Notes |
| --- | --- | --- | --- |
| `npm run typecheck --workspace apps/web` | Passed | 170.2s | Ran before dependency rehydration; no source changes required. |
| `npm ci --no-audit --no-fund` | Passed | 865.6s | Run because local API workspace dependencies were missing after branch switch; changed only local install state. |
| `DATABASE_URL=... DIRECT_URL=... npx prisma generate --config prisma/prisma.config.ts --schema prisma/schema.prisma` from `apps/api` | Passed | 37.2s | CI-equivalent Prisma client generation with dummy local DB URLs; no production DB access. |
| `npm run typecheck --workspace apps/api` | Passed | 272.7s | Initial run failed before `npm ci`/Prisma generate due missing local deps/stale Prisma client; rerun passed. |
| `npm run build --workspace apps/api` | Passed | 286.6s | Initial run failed before `npm ci`/Prisma generate due missing local deps/stale Prisma client; rerun passed. |
| `npm run build --workspace apps/web` | Passed | 1182.8s | Optional web build ran with dummy build-time DB/auth env and `SKIP_ENV_VALIDATION=true`. |

## Remaining Risks

- Latest inspected `main` still shows stale `illustrious-warmth` statuses, including a failing full scaffold status.
- Branch protection could not be inspected with current tooling; required checks need manual GitHub admin review.
- GHCR main publishing fails at Trivy and should be classified separately from Railway cleanup.
- `API_INTERNAL_ORIGIN` remains unproven/not set.
- Live DB schema/migration drift and the quarantined destructive `EdgeNode` migration remain unresolved.
- PR #6 must not merge as-is.

This audit does not claim `PRODUCTION_READY` or `CONTROLLED_BETA_READY`.

## Safety Notes

No DB schema edits, Prisma schema changes, migrations, Supabase production data changes, Vercel/Railway/Clerk/Redis env or secret changes, PR #6 changes, OAuth scope changes, Chrome permission changes, LinkedIn automation changes, dependency upgrades, or production infrastructure changes were made.
