# Post-Revert Deployment Triage

Date: 2026-06-22
Agent: deployment-triage-agent
Status: NEEDS_REPLAN

## Latest Main Inspected

| Field | Value |
| --- | --- |
| Repository | `Convospanai-outreach/fullstack` |
| Branch | `origin/main` |
| Commit inspected | `094663f21804fa858a28763af9a0f0e0383b4880` |
| Commit subject | `Merge pull request #28 from Convospanai-outreach/codex/revert-dependabot-pr22` |

## GitHub Status Checks

GitHub commit status API for `094663f21804fa858a28763af9a0f0e0383b4880` returned overall `failure`.

### Deployment Status Contexts

These are deployment-provider commit statuses, not GitHub Actions jobs:

| Context | State | Description | Evidence |
| --- | --- | --- | --- |
| `airy-balance - convospan-full-scaffold` | failure | `Deployment failed` | Railway project `ca66bd2e-8d27-4167-ae1f-f6c54475c96e`, service `254fd832-badc-4443-ba2a-d0e5a63205e0` |
| `illustrious-warmth - convospan-api-split` | failure | `Deployment failed` | Railway project `e36d48cd-3ea7-44e4-934c-e7c214bdfb28`, service `4de7467d-48cc-45b5-a192-39a747d4814f` |
| `illustrious-warmth - convospan-full-scaffold` | failure | `Deployment failed` | Railway project `e36d48cd-3ea7-44e4-934c-e7c214bdfb28`, service `0bece06e-90cd-4bd3-a210-5c74f268c2a8` |
| `airy-balance - convospan-api-split` | success | `Success - convospan-api-split-production.up.railway.app` | Railway project `ca66bd2e-8d27-4167-ae1f-f6c54475c96e`, service `cfacab6e-8695-4e94-8a59-061e2e6f7a30` |
| `Vercel` | success | `Deployment has completed` | Vercel project `fullstack-web-xkxn` deployment URL in status target |

At inspection time, Vercel was no longer pending; it was `success`.

### GitHub Actions And App Checks

These are GitHub check-runs, not Railway/Vercel deploy statuses:

| Check | Status | Conclusion | Category |
| --- | --- | --- | --- |
| `Dependabot` | in_progress | n/a | GitHub Actions |
| `Supabase Preview` | completed | success | Supabase app check |
| `Merge Gate` | completed | success | GitHub Actions |
| `vercel-parity-build` | completed | failure | GitHub Actions |
| `Verify Phi-3 Safety Enforcement` | completed | success | GitHub Actions |
| `Production Stability Audit (apps/web)` | completed | failure | GitHub Actions |
| `build-and-push` | completed | failure | GitHub Actions / GHCR Docker |
| `Web Build (apps/web)` | completed | failure | GitHub Actions |
| `API Strict Typecheck (apps/api)` | completed | success | GitHub Actions |
| `Docker Build Smoke (api required, edge-fastapi optional)` | completed | success | GitHub Actions |

Failure annotations available through the GitHub API were generic for `vercel-parity-build`, `Production Stability Audit`, and `Web Build`: `Process completed with exit code 1.` The `build-and-push` annotation identified the failing Docker step as the web image build command:

`DATABASE_URL="***localhost/dummy" npx prisma generate && DATABASE_URL="***localhost/dummy" ENCRYPTION_KEY="${ENCRYPTION_KEY}" NEXT_OUTPUT_MODE="standalone" NODE_OPTIONS="--max-old-space-size=4096" npx next build`

The full Railway deployment logs were not available from the repository or public GitHub status payloads.

## PR #28 Revert Scope

PR #28 reverted the package-only Dependabot merge commit `31c76f836ef44bb4baf240f496979ce5b6bf5ce1`.

Diff from latest main's first parent to latest main touches only:

- `apps/api/package.json`
- `apps/web/package.json`
- `apps/web/package-lock.json`
- `package-lock.json`

Diff from the pre-Dependabot parent `c540af4` to latest main shows only `package-lock.json`, reflecting the `npm install` lockfile consistency update that was amended into the revert hotfix. No app source files changed in PR #28.

Verdict: Dependabot PR #22's app dependency bumps were reverted. The only remaining delta versus pre-PR #22 is root lockfile consistency output from `npm install`.

## PR #25 Provider Fix

`apps/web/src/app/providers.tsx` still includes the public session-free route entries from PR #25:

- `/security`
- `/support`
- `/data-deletion`
- `/google-api-disclosure`
- `/funnel`
- `/help`
- `/faq`

PR #25's public session fetch fix remains preserved.

## PR #23 Hero UI Fixes

Merge commit `4367d7b` for PR #23 is an ancestor of `origin/main`. PR #28 changed only package files, so the hero UI app-code changes remain preserved by ancestry and were not touched in this triage.

## Railway Mapping Found In Repo

No committed Railway-specific config was found:

- No `railway.toml`
- No `nixpacks.toml`
- No Railpack config
- No `Procfile`

Committed deployment-relevant files found:

| File | Relevant mapping |
| --- | --- |
| `apps/api/package.json` | Package name `craftmyfunnel-api-split`; scripts: `build`, `typecheck`, `start`, `dev` |
| `apps/web/package.json` | Package name `craftmyfunnel-full-scaffold`; scripts: `build`, `typecheck`, `start`, `dev` |
| `apps/api/Dockerfile` | Builds API from repo root context and runs `tsx server.ts` on `PORT=3001` |
| `apps/web/Dockerfile` | Builds Next.js standalone image from repo root context and runs `node server.js` on `PORT=3000` |
| `apps/docker-compose.split.yml` | Local split deployment names `api` and `web`; sets `API_INTERNAL_ORIGIN: http://api:3001` only for local Docker network |

Because there is no repo-level Railway config, Railway service root directory, builder, build command, start command, healthcheck, and env mapping must be coming from Railway dashboard settings or Railway auto-detection.

## Railway Services Observed

GitHub deployment statuses reveal two Railway projects with overlapping service names:

| Railway project context | Service | Status on latest main | Interpretation |
| --- | --- | --- | --- |
| `airy-balance` | `convospan-api-split` | success | Likely the active/current API service; status description exposes `convospan-api-split-production.up.railway.app`. |
| `airy-balance` | `convospan-full-scaffold` | failure | Web service in the same project is failing or stale. Vercel is already deploying the web app successfully, so dashboard ownership needs confirmation. |
| `illustrious-warmth` | `convospan-api-split` | failure | Duplicate/stale API service or wrong service configuration. |
| `illustrious-warmth` | `convospan-full-scaffold` | failure | Duplicate/stale web service or wrong service configuration. |

## Likely Cause Of Each Railway Failure

| Failing context | Likely cause from available evidence | What must be checked in Railway |
| --- | --- | --- |
| `airy-balance - convospan-full-scaffold` | Repo has no Railway config; Vercel succeeds and local `npm run build --workspace apps/web` succeeds, so this is likely a Railway web service dashboard mismatch, stale service, wrong root/build command, missing runtime env, or failing web healthcheck rather than a reverted package bump. The web Dockerfile healthcheck calls `/api/health`, which defaults to production readiness and returns `503` if DB is unreachable. | Confirm whether this web service is intentionally active. If yes, verify root is repo root for Dockerfile builds or `apps/web` for Nixpacks, verify build/start commands, verify required runtime env, and check whether healthcheck should use `/api/health?probe=live` instead of readiness. |
| `illustrious-warmth - convospan-api-split` | Duplicate project with same API service name while `airy-balance - convospan-api-split` succeeds. This looks stale or misconfigured. | Confirm whether project `e36d48cd-3ea7-44e4-934c-e7c214bdfb28` should still be connected to `main`. If obsolete, disconnect GitHub deploys or archive service. If active, compare root/build/start/env settings against the successful `airy-balance` API service. |
| `illustrious-warmth - convospan-full-scaffold` | Duplicate project with same web service name and failure. Vercel succeeds for the web app, and local web build succeeds. | Confirm whether this duplicate web service is obsolete. If active, compare service path/build/start/env/healthcheck to the intended web deployment target. |

The failed GitHub Actions web build and Docker web image build remain separate CI blockers. They are not proven to be the same root cause as Railway deployment failures because local web typecheck and local web build passed on this machine.

## API_INTERNAL_ORIGIN

`apps/web/src/app/api/proxy/[...path]/route.ts` and `apps/web/src/app/api/extension/[...path]/route.ts` resolve the upstream backend origin in this order:

1. `API_INTERNAL_ORIGIN`
2. `API_BASE_URL`
3. `http://localhost:3001`

The value must be an absolute URL and must be the backend API origin. It should not point to the Vercel `/api/proxy` route, because that would risk proxy recursion or routing to the wrong service.

Available evidence shows a successful Railway API service status with host text `convospan-api-split-production.up.railway.app`, but the repo does not prove whether Vercel should use that public Railway URL, a custom API domain, or another dashboard-managed backend origin.

Required dashboard value to confirm: the canonical HTTPS origin for the active API service backing production web proxy requests, for example an exact value shaped like `https://<active-api-service-or-custom-domain>`, with no trailing path. Do not set or change it from this triage.

For same-network Railway web-to-api deployments only, a private Railway/internal origin may be appropriate. For Vercel-hosted web, the origin must be reachable from Vercel, so a public HTTPS API origin or custom API domain is expected.

## Local Validation

| Command | Result |
| --- | --- |
| `npm run typecheck --workspace apps/web` | Passed |
| `npm run typecheck --workspace apps/api` | Passed |
| `npm run build --workspace apps/api` | Passed |
| `npm run build --workspace apps/web` | Passed locally in 831.1s |
| `docker --version` | Failed: Docker CLI is not installed in this environment |

Railway/Docker build command was inspected through `apps/api/Dockerfile`, `apps/web/Dockerfile`, and workflow annotations. It could not be executed locally because Docker is unavailable.

## Next Manual Dashboard Checks

1. In Railway, identify which project is canonical: `airy-balance` or `illustrious-warmth`.
2. Confirm whether `convospan-full-scaffold` should deploy on Railway at all now that Vercel deploys the web app successfully.
3. Disable/archive stale duplicate Railway services or disconnect their GitHub deployment statuses if they are no longer production targets.
4. For the active `convospan-api-split`, confirm root directory, builder, Dockerfile path or build command, start command, healthcheck path, and public/custom domain.
5. For any active Railway web service, verify root/build/start settings and change healthcheck away from DB-readiness if the service should only prove container liveness.
6. Confirm the exact production `API_INTERNAL_ORIGIN` value from the active API service dashboard or custom domain. Do not infer it from service name alone.
7. Inspect full Railway deployment logs for each failed service because GitHub status payloads only expose `Deployment failed`.

## Non-Changes

No DB schema edits, Prisma migrations, Supabase production data changes, Redis changes, Clerk dashboard changes, Vercel/Railway secret changes, PR #6 changes, destructive SQL, or production env changes were performed.

This audit does not claim production readiness. Vercel `success` and Railway deploy statuses are deployment signals only, not launch-readiness proof.
