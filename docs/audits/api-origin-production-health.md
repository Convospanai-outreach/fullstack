# API Origin And Production Health Audit

Date: 2026-06-24
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `d3bcbb3a12d7c184c0258cfaa0ea8cf5ab6fa8e8`
Source commit: Merge PR #41, `Investigate API origin and production health readiness`

## Readiness Verdict

Verdict: `NEEDS_INPUT`.

The code path has a liveness/readiness split and the public proxy surface is intentionally auth-protected. The remaining blockers require dashboard confirmation, not a code change:

- Vercel Production `DATABASE_URL` presence/value target, without exposing secrets
- Exact active backend API origin for `API_INTERNAL_ORIGIN`
- Verification of whether stale `illustrious-warmth` Railway contexts are still required checks

This audit does not claim production readiness.

## Latest Main Status

| Signal | Result | Notes |
| --- | --- | --- |
| Latest main | `d3bcbb3a12d7c184c0258cfaa0ea8cf5ab6fa8e8` | PR #41 merge commit |
| Vercel | success | Completed successfully |
| `airy-balance - convospan-api-split` | success | Active Railway backend |
| `airy-balance - convospan-full-scaffold` | success | Active Railway scaffold |
| `illustrious-warmth - convospan-api-split` | success | Stale context success (no-op) |
| `illustrious-warmth - convospan-full-scaffold` | success | Stale context success (no-op) |

## Production Health Checks

Probes were conducted using external DNS overrides:

| Endpoint | HTTP Status | Body Summary | Verdict |
| --- | --- | --- | --- |
| `/api/health?probe=live` | 200 | `{"status":"alive","probe":"liveness"}` | Liveness passes (process alive) |
| `/api/health?probe=ready` | 503 | `{"status":"unhealthy","probe":"readiness","checks":{"database":"down"}}` | Readiness fails (database check down) |
| `/api/health` | 503 | `{"status":"unhealthy","probe":"readiness","checks":{"database":"down"}}` | Readiness fails (defaults to readiness in prod) |
| `/api/proxy/health` | 401 | `{"error":"Unauthorized"}` | Expected auth gate |

## API Proxy Behavior

`apps/web/src/app/api/proxy/[...path]/route.ts` reads the upstream origin in this order:
1. `API_INTERNAL_ORIGIN`
2. `API_BASE_URL`
3. `http://localhost:3001`

`API_INTERNAL_ORIGIN` must be an absolute HTTPS URL (e.g., `https://<active-api-service-or-custom-domain>`). It must not be recursive (i.e. pointing to the proxy endpoint itself).

## Manual Dashboard Checks Required from Human

Ask the human to verify these values without sharing secrets:

### Vercel Project:
- Team: `team_ju8AaZfJ8hE4jmsMW0tTnAJ5`
- Project: `fullstack-web-xkxn`
- Project ID: `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8`

### Vercel Production Settings:
1. `DATABASE_URL` exists.
2. `DATABASE_URL` points to the intended production Supabase/Postgres target.
3. `DATABASE_URL` uses the correct pooled/runtime connection form for Vercel serverless.
4. SSL requirements match runtime.
5. `DIRECT_URL` exists only for migration workflows and is not the runtime health dependency.
6. `API_INTERNAL_ORIGIN` exists only if the real backend API origin is confirmed.
7. `API_INTERNAL_ORIGIN` must be an absolute HTTPS origin.
8. `API_INTERNAL_ORIGIN` must not be set to `https://www.craftmyfunnel.live/api/proxy`.

### Railway Settings:
1. Which backend API service is canonical and active.
2. Whether `airy-balance - convospan-api-split` is the real active backend.
3. Exact public/custom HTTPS origin for the API service.
4. Whether old `illustrious-warmth` contexts are stale and should be removed from required checks.

## Safety Notes

No DB, Prisma schema, migrations, Vercel/Railway secrets, OAuth scopes, Chrome permissions, PR #6, or UI changes were made in this audit.
