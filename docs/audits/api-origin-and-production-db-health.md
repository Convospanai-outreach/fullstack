# API Origin And Production DB Health

Date: 2026-06-24
Agent: api-origin-health-readiness-agent
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `34c3339c280e0922567cc203b9edd3c435c073c1`
Source commit: Merge PR #40, `Production smoke and API proxy readiness after PR39`

## Readiness Verdict

Verdict: `NEEDS_INPUT`.

The code path already has a liveness/readiness split and the public proxy surface is intentionally auth-protected. The remaining blockers require dashboard confirmation, not a code change in this phase:

- exact Vercel Production `DATABASE_URL` presence/value target, without exposing the secret
- exact active backend API origin for `API_INTERNAL_ORIGIN`
- whether stale `illustrious-warmth` Railway contexts are still configured as required branch-protection checks

This audit does not claim production readiness.

## Latest Main Status

| Signal | Result | Notes |
| --- | --- | --- |
| Latest main | `34c3339c280e0922567cc203b9edd3c435c073c1` | PR #40 merge commit |
| Vercel | success | `Deployment has completed` |
| `airy-balance - convospan-api-split` | success | `No deployment needed - watched paths not modified` |
| `airy-balance - convospan-full-scaffold` | success | `No deployment needed - watched paths not modified` |
| `illustrious-warmth - convospan-api-split` | success | stale/duplicate context still appears |
| `illustrious-warmth - convospan-full-scaffold` | success | stale/duplicate context still appears |

GitHub Actions/check-runs on the latest main commit are green:

| Workflow / check | Status | Conclusion |
| --- | --- | --- |
| `CI` | completed | success |
| `Production Readiness Gate` | completed | success |
| `Vercel Parity Build` | completed | success |
| `Phi-3 Verification` | completed | success |
| CodeQL / `Push on main` | completed | success |
| `Web Build (apps/web)` | completed | success |
| `API Strict Typecheck (apps/api)` | completed | success |
| `Docker Build Smoke (api required, edge-fastapi optional)` | completed | success |
| `Production Stability Audit (apps/web)` | completed | success |
| `vercel-parity-build` | completed | success |
| `Supabase Preview` | completed | success |

## Railway Context Interpretation

`airy-balance` is the active Railway context family according to the existing stale-check cleanup audit:

- `airy-balance - convospan-api-split`
- `airy-balance - convospan-full-scaffold`

`illustrious-warmth` is documented as stale/duplicate and should not be treated as a release gate:

- `illustrious-warmth - convospan-api-split`
- `illustrious-warmth - convospan-full-scaffold`

Current evidence shows the stale contexts still appear on latest main, but they are no-op success statuses. Branch-protection required-check configuration still needs manual GitHub admin confirmation because available tooling does not expose the required-check list.

## API Proxy Behavior

`apps/web/src/app/api/proxy/[...path]/route.ts` reads the upstream origin in this order:

1. `API_INTERNAL_ORIGIN`
2. `API_BASE_URL`
3. `http://localhost:3001`

The required value shape is an absolute HTTP(S) origin:

```text
https://<active-api-service-or-custom-domain>
```

For Vercel-hosted web, the value must be reachable from Vercel production runtime. A Railway private network origin may only be appropriate for same-network Railway web-to-api deployments, not for Vercel-hosted web.

The route rejects invalid origins and includes a recursion guard:

- non-absolute origins throw `API_INTERNAL_ORIGIN must be an absolute URL`
- targets whose origin equals the web app origin and whose path starts with `/api/proxy` throw `Invalid proxy target: recursive proxy detected`

Generic `/api/proxy` and `/api/proxy/health` return unauthenticated `401` because `apps/web/src/proxy.ts` does not list generic `/api/proxy` as a public API prefix. That behavior is expected and does not prove whether the upstream origin is valid.

## Backend Origin Candidates

The latest main status metadata exposes only Railway dashboard URLs and no public API host.

Older status evidence in `docs/audits/post-revert-deployment-triage.md` recorded `convospan-api-split-production.up.railway.app` as a public host candidate for `airy-balance - convospan-api-split`. That host remains a candidate only. It is not confirmed as the final production `API_INTERNAL_ORIGIN` because the repo does not prove whether production should use that Railway domain, a custom API domain, or another backend origin.

## Manual Dashboard Values Needed

Confirm these without exposing secrets in docs or PR comments:

1. In Railway, confirm the canonical active project/service for the backend API.
2. In Railway, copy the exact public/custom HTTPS origin for that backend API service.
3. In Vercel Production, confirm whether `API_INTERNAL_ORIGIN` exists and equals that exact HTTPS origin.
4. In Vercel Production, confirm whether `API_BASE_URL` exists and whether it is intentionally used as fallback.
5. In GitHub branch protection, confirm `illustrious-warmth` contexts are not required checks.
6. In Railway, disconnect/archive stale `illustrious-warmth` GitHub deployment contexts if they are obsolete.

## Recommended Next Step

Manual dashboard input is required before code changes:

- confirm/set the canonical `API_INTERNAL_ORIGIN`
- confirm Vercel Production `DATABASE_URL` target/connectivity
- confirm stale Railway required-check cleanup

GHCR policy remains unresolved for this phase because no `Register Docker Images to GHCR` workflow run was observed on the latest main commit. Treat GHCR as a separate release-gate policy decision unless that workflow is explicitly required for this phase.

If the platform wants `/api/health` without query params to be liveness for container healthchecks, create a small follow-up PR to change the Docker/Railway healthcheck path to `/api/health?probe=live` rather than changing readiness semantics. The current application code already supports this.

## Local Validation

| Command | Result | Duration |
| --- | --- | --- |
| `npm run typecheck --workspace apps/web` | PASS | 65.5s |
| `npm run typecheck --workspace apps/api` | PASS | 86.4s |
| `npm run build --workspace apps/api` | PASS | 94.5s |
| `npm run build --workspace apps/web` with dummy local DB URLs and CI placeholder auth env | PASS | 854.6s |

The web build emitted non-blocking warnings about npm unknown env config `tmp` and stale Browserslist data.

## Safety Notes

No DB schema, Prisma schema, migration, Supabase production data, production DB connection, Vercel/Railway/Clerk/Redis env, secrets, PR #6, OAuth scopes, Chrome extension permissions, LinkedIn automation, package, workflow, source, or UI changes were made.
