# Production Custom Domain Smoke After PR39

Date: 2026-06-24
Agent: post-pr39-production-smoke-agent
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `6d012102ebfeff47e8a95cf72fda5955a76aee1e`
Source commit: Merge PR #39, `Document stale Railway check cleanup and phased improvement plan`

## Verdict

Public custom-domain smoke is `READY_FOR_NEXT_STAGE` for the checked public pages. Overall production readiness remains `NEEDS_REPLAN` because API origin, live DB readiness, stale Railway contexts, optional GHCR policy, schema drift, and PR #6 blockers remain unresolved and need manual dashboard input.

This is not a production-readiness claim.

## Deployment And Check Status

GitHub Actions on latest main all completed successfully for the inspected commit:

| Workflow / check | Status | Conclusion | Notes |
| --- | --- | --- | --- |
| `CI` | completed | success | Run `28049506210` |
| `Production Readiness Gate` | completed | success | Run `28049505924` |
| `Vercel Parity Build` | completed | success | Run `28049506236` |
| `Phi-3 Verification` | completed | success | Run `28049506579` |
| CodeQL / `Push on main` | completed | success | Run `28049502377` |
| `Analyze (actions)` | completed | success | Check run green |
| `Analyze (javascript-typescript)` | completed | success | Check run green |
| `Analyze (python)` | completed | success | Check run green |
| `API Strict Typecheck (apps/api)` | completed | success | Check run green |
| `Docker Build Smoke (api required, edge-fastapi optional)` | completed | success | Check run green |
| `Merge Gate` | completed | success | Check run green |
| `Production Stability Audit (apps/web)` | completed | success | Check run green |
| `Supabase Preview` | completed | success | Check run green |
| `vercel-parity-build` | completed | success | Check run green |
| `Verify Phi-3 Safety Enforcement` | completed | success | Check run green |
| `Web Build (apps/web)` | completed | success | Check run green |

Vercel status on latest main is `success` and the deployment completed.

Railway statuses on latest main are green, but stale duplicate contexts still appear:

| Context | State | Notes |
| --- | --- | --- |
| `airy-balance - convospan-full-scaffold` | success | No deployment needed, watched paths not modified |
| `airy-balance - convospan-api-split` | success | No deployment needed, watched paths not modified |
| `illustrious-warmth - convospan-api-split` | success | No deployment needed, watched paths not modified; context still appears |
| `illustrious-warmth - convospan-full-scaffold` | success | No deployment needed, watched paths not modified; context still appears |

`Register Docker Images to GHCR` did not produce a run for latest main because PR #39 changed docs only and `.github/workflows/docker-ghcr.yml` path filters do not include docs. Per the current cleanup plan, GHCR should be treated as optional image-publishing evidence unless explicitly required as a release gate.

## Test Method

Local DNS maps `www.craftmyfunnel.live` and `craftmyfunnel.live` to localhost, so direct local browser and `Invoke-WebRequest` calls fail with connection refused. Meaningful checks used Vercel edge DNS override:

```text
--host-resolver-rules=MAP www.craftmyfunnel.live 76.76.21.21,MAP craftmyfunnel.live 76.76.21.21
```

Direct endpoint checks used:

```text
curl.exe --resolve www.craftmyfunnel.live:443:76.76.21.21 --max-time 45 -sS -D - https://www.craftmyfunnel.live<path> -o -
```

## Browser Smoke Results

All checked pages rendered non-blank content and produced no browser console warnings/errors, no page errors, no crash text, no `/api/auth/session` requests, no `/api/auth/_log` requests, and no `/api/proxy` requests during the smoke pass.

| Path | HTTP status | Final URL | Session calls | Console/page errors | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | 200 | `https://www.craftmyfunnel.live/` | 0 | 0 | Public page rendered; `support@craftmyfunnel.live` present |
| `/funnel` | 200 | `https://www.craftmyfunnel.live/funnel` | 0 | 0 | Public page rendered; no login redirect |
| `/security` | 200 | `https://www.craftmyfunnel.live/security` | 0 | 0 | Approval/legal page rendered |
| `/support` | 200 | `https://www.craftmyfunnel.live/support` | 0 | 0 | Approval/support page rendered |
| `/data-deletion` | 200 | `https://www.craftmyfunnel.live/data-deletion` | 0 | 0 | Approval/legal page rendered |
| `/google-api-disclosure` | 200 | `https://www.craftmyfunnel.live/google-api-disclosure` | 0 | 0 | Approval/legal page rendered |
| `/terms` | 200 | `https://www.craftmyfunnel.live/terms` | 0 | 0 | Legal page rendered |
| `/contact` | 200 | `https://www.craftmyfunnel.live/contact` | 0 | 0 | Contact page rendered |
| `/login` | 200 | `https://www.craftmyfunnel.live/login` | 0 | 0 | Login page rendered |
| `/dashboard` | 200 | `https://www.craftmyfunnel.live/login?callbackUrl=%2Fdashboard` | 0 | 0 | PASS: unauthenticated dashboard access redirects to login |

Old approval email values were absent from checked pages:

- `bizcomm.soulutions@gmail.com`
- `support@craftmyfunnel.com`
- `enterprise@craftmyfunnel.com`

`support@craftmyfunnel.live` was present where expected.

## Direct Endpoint Results

| Endpoint | HTTP status | Body / behavior | Verdict |
| --- | --- | --- | --- |
| `/api/auth/session` | 200 | `{}` with `X-Matched-Path: /api/auth/[...nextauth]` and `X-Clerk-Auth-Status: signed-out` | PASS: direct NextAuth session endpoint is healthy for signed-out users |
| `/api/proxy` | 401 | `{"error":"Unauthorized"}` | Expected unauthenticated middleware block; does not prove backend origin |
| `/api/proxy/health` | 401 | `{"error":"Unauthorized"}` | Expected unauthenticated middleware block; does not prove backend origin |
| `/api/health` | 503 | `{"status":"unhealthy","probe":"readiness","service":"craftmyfunnel-web","checks":{"database":"down"}}` | BLOCKER: production web readiness sees database down |

The `/api/health` 503 response is a release-readiness blocker. This audit did not change DB, env, or production data.

## Public Session Fetch Fix

`apps/web/src/app/providers.tsx` still contains the PR #25 session-free route split. The public list includes:

- `/`
- `/security`
- `/support`
- `/data-deletion`
- `/google-api-disclosure`
- `/funnel`
- `/help`
- `/faq`

The production browser smoke confirms those public pages do not unnecessarily fetch `/api/auth/session`.

## `/p/*` Public Routing

`apps/web/src/proxy.ts` still preserves intended public `/p/*` behavior:

- `"/p"` is included in `publicPaths`.
- `path.startsWith("/p/")` is included in the public route guard.

## Local Validation

| Command | Result | Duration |
| --- | --- | --- |
| `npm run typecheck --workspace apps/web` | PASS | 75.3s |
| `npm run typecheck --workspace apps/api` | PASS | 88.6s |
| `npm run build --workspace apps/api` | PASS | 92.8s |
| `npm run build --workspace apps/web` with dummy local DB URLs and CI placeholder auth env | PASS | 962.5s |

The web build emitted non-blocking warnings about npm unknown env config `tmp` and stale Browserslist data.

## Remaining Blockers

- `API_INTERNAL_ORIGIN` remains unproven and must not be guessed.
- Production `/api/health` reports database readiness `down`.
- Stale `illustrious-warmth` Railway contexts still appear on latest main, although they are currently success/no-op statuses.
- GHCR did not run for this docs-only merge; decide whether it remains optional image-publishing evidence or a required release gate.
- Live DB migration/schema drift remains unresolved.
- Live DB is still missing Clerk/invite schema required by application code.
- Unsafe `20260604140000_edge_runtime_pairing` migration still requires quarantine/replan before production migration.
- Stage 13 dependency-security alert mapping remains future work.
- PR #6 must not merge as-is.

## Manual Dashboard Values Still Needed

- Exact canonical production backend API origin or custom API domain that should be used for `API_INTERNAL_ORIGIN`.
- Confirmation that Vercel Production has `API_INTERNAL_ORIGIN` set to that exact absolute origin after the backend origin is confirmed.
- Confirmation of the production DB connection/env state causing `/api/health` to report `database: down`.
- Branch protection required-check list confirming stale `illustrious-warmth` contexts are not required.

## Safety Notes

No DB schema, Prisma schema, migration, Supabase production data, Redis, Clerk dashboard, Vercel/Railway secrets/env, PR #6, OAuth scope, Chrome extension permission, LinkedIn automation, app source, package, workflow, or UI changes were made.
