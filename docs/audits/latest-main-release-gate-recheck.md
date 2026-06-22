# Latest Main Release Gate Recheck

Date: 2026-06-23
Agent: release-gate-recheck-agent
Status: NEEDS_REPLAN

## Latest Commit Inspected

| Field | Value |
| --- | --- |
| Repository | `Convospanai-outreach/fullstack` |
| Branch | `origin/main` |
| Commit inspected | `a232648be04aae66ed89c6779503486bd76d32a4` |
| Commit subject | `Merge pull request #30 from Convospanai-outreach/codex/post-revert-deployment-triage` |

## Deployment Statuses

GitHub commit status API for `a232648be04aae66ed89c6779503486bd76d32a4` returned overall `success`.

| Context | State | Description | Classification |
| --- | --- | --- | --- |
| `Vercel` | success | `Deployment has completed` | Deployment status |
| `airy-balance - convospan-full-scaffold` | success | `No deployment needed - watched paths not modified` | Railway deployment status |
| `illustrious-warmth - convospan-api-split` | success | `No deployment needed - watched paths not modified` | Railway deployment status |
| `illustrious-warmth - convospan-full-scaffold` | success | `No deployment needed - watched paths not modified` | Railway deployment status |
| `airy-balance - convospan-api-split` | success | `No deployment needed - watched paths not modified` | Railway deployment status |

Vercel is no longer pending for this commit. Railway statuses are green, but all four Railway contexts are no-op statuses because the PR #30 merge changed docs/workflow files only and did not touch watched deploy paths.

## GitHub Actions Status

GitHub check-runs API for `a232648be04aae66ed89c6779503486bd76d32a4` returned:

| Check | Status | Conclusion | Classification |
| --- | --- | --- | --- |
| `Supabase Preview` | completed | success | Supabase app check |
| `Merge Gate` | completed | success | GitHub Actions |
| `Web Build (apps/web)` | completed | failure | GitHub Actions |
| `vercel-parity-build` | completed | failure | GitHub Actions |
| `API Strict Typecheck (apps/api)` | completed | success | GitHub Actions |
| `Docker Build Smoke (api required, edge-fastapi optional)` | completed | success | GitHub Actions |
| `Verify Phi-3 Safety Enforcement` | completed | success | GitHub Actions |
| `Production Stability Audit (apps/web)` | completed | failure | GitHub Actions |

`build-and-push` was not present in the check-runs returned for this docs-only latest-main commit.

## Failing Job Classification

| Failing job | Evidence available | Root cause classification | Code/workflow/env/platform |
| --- | --- | --- | --- |
| `Web Build (apps/web)` | GitHub annotation only says `Process completed with exit code 1.` The workflow runs `npm audit --audit-level=high --omit=dev` before typecheck/build. Local `npm audit --workspace apps/web --audit-level=high --omit=dev` fails with 18 vulnerabilities, including 6 high. Local `npm run build --workspace apps/web` passes. | Dependency/security audit gate failure is the strongest local reproduction; not a local Next.js build failure. | Dependency policy / workflow gate |
| `Production Stability Audit (apps/web)` | GitHub annotation only says `Process completed with exit code 1.` The workflow also runs `npm audit --audit-level=high --omit=dev` before Prisma/test/readiness steps. Local matching web audit fails. | Dependency/security audit gate failure is likely; full GitHub logs are needed to prove the exact failed step. | Dependency policy / workflow gate |
| `vercel-parity-build` | GitHub annotation points at the workflow step `Generate Prisma Client (build-only, no real DB)`. Exact local command with dummy `DATABASE_URL` and `DIRECT_URL` passed. | Prisma generation failure in CI, not reproduced locally; likely CI environment/workflow-specific until logs are available. | Workflow/CI environment or platform check |

GitHub Actions job logs were requested through the public GitHub API, but the log endpoints returned `403 Forbidden`; only check-run annotations were available.

## PR #25 Provider Fix

`apps/web/src/app/providers.tsx` still contains the PR #25 public session-free routes:

- `/security`
- `/support`
- `/data-deletion`
- `/google-api-disclosure`
- `/funnel`
- `/help`
- `/faq`

The public session fetch fix remains present on latest main.

## Production Auth Session Smoke

Direct custom-domain request:

`curl --resolve www.craftmyfunnel.live:443:76.76.21.21 -i https://www.craftmyfunnel.live/api/auth/session`

Result:

- HTTP `200 OK`
- `Content-Type: application/json`
- Matched route: `X-Matched-Path: /api/auth/[...nextauth]`
- Body: `{}`

This confirms the direct NextAuth session endpoint is not currently returning the earlier `NO_SECRET` 500 on the production custom domain.

## API_INTERNAL_ORIGIN

`API_INTERNAL_ORIGIN` cannot be safely resolved from available repo and status evidence.

Known evidence:

- Web proxy routes resolve upstream in this order: `API_INTERNAL_ORIGIN`, `API_BASE_URL`, then `http://localhost:3001`.
- `apps/docker-compose.split.yml` uses `API_INTERNAL_ORIGIN: http://api:3001`, but that is only valid inside the local Docker network.
- Railway status contexts include `airy-balance - convospan-api-split`, but latest main reports `No deployment needed - watched paths not modified`, not an authoritative production API URL.
- Prior Railway status text exposed `convospan-api-split-production.up.railway.app`, but repo config does not prove whether that host, a custom API domain, or another service origin is the canonical production backend.

Required manual dashboard value: the exact canonical absolute HTTPS origin for the active backend API service reachable from Vercel, with no path, for example `https://<active-api-domain>`. Do not infer or set it from service names alone.

## Local Validation

| Command | Result |
| --- | --- |
| `npm run typecheck --workspace apps/web` | Passed |
| `npm run typecheck --workspace apps/api` | Passed |
| `npm run build --workspace apps/api` | Passed |
| `npm run build --workspace apps/web` | Passed in `917.7s` |
| `npm audit --workspace apps/web --audit-level=high --omit=dev` | Failed; 18 vulnerabilities reported, including 6 high |
| `npx prisma generate --config prisma/prisma.config.ts --schema prisma/schema.prisma` in `apps/web` with dummy `DATABASE_URL`/`DIRECT_URL` | Passed |

The local web build generated `apps/web/next-env.d.ts`; that generated change was reverted and is not part of this audit.

## Next Manual Checks

1. Open the `Web Build (apps/web)` and `Production Stability Audit (apps/web)` GitHub Actions logs and confirm whether the first failing step is `npm audit --audit-level=high --omit=dev`.
2. Decide whether the security audit gate should stay blocking before addressing the high vulnerabilities, or whether targeted dependency upgrades should be handled in smaller non-Dependabot PRs.
3. Open the `vercel-parity-build` logs and confirm why CI Prisma generation exits 1 even though the same command passes locally.
4. Confirm the canonical active Railway API service and exact public/custom API origin for `API_INTERNAL_ORIGIN`.
5. Keep stale/duplicate Railway services disconnected or confirmed no-op so green commit statuses do not hide obsolete deploy surfaces.

## Non-Changes And Disclaimer

No source code, DB schema, Prisma migrations, Supabase production data, Redis config, Clerk dashboard settings, Vercel/Railway secrets, production env values, PR #6 files, destructive SQL, or auth/RLS/security checks were changed.

This audit does not claim production readiness. Vercel and Railway success statuses are deployment signals only; release readiness remains blocked by the documented CI, env-origin, schema drift, migration safety, and PR #6 issues.
