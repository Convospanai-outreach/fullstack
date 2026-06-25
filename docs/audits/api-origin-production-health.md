# API Origin And Production Health Audit

Date: 2026-06-25
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `88dd014a07c583ce2fd528dcee49c756d937cf6d`
Source commit: Merge PR #42, `docs(readiness): update api origin production health audit`

## Readiness Verdict

Verdict: `COMPLETED` for DB Readiness Check.

The database connectivity issue has been successfully resolved. Production health probes now return `200 OK` with database status `"up"`.

Remaining next actions:
- Confirm exact active backend API origin for `API_INTERNAL_ORIGIN`
- Verification of whether stale `illustrious-warmth` Railway contexts are still required checks
- Resolve schema/auth tenant migrations (missing fields)

## Latest Main Status

| Signal | Result | Notes |
| --- | --- | --- |
| Latest main | `88dd014a07c583ce2fd528dcee49c756d937cf6d` | PR #42 merge commit |
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
| `/api/health?probe=ready` | 200 | `{"status":"healthy","probe":"readiness","checks":{"database":"up"}}` | Readiness passes (database check up) |
| `/api/health` | 200 | `{"status":"healthy","probe":"readiness","checks":{"database":"up"}}` | Readiness passes (defaults to readiness in prod) |
| `/api/proxy/health` | 401 | `{"error":"Unauthorized"}` | Expected auth gate |

## API Proxy Behavior

`apps/web/src/app/api/proxy/[...path]/route.ts` reads the upstream origin in this order:
1. `API_INTERNAL_ORIGIN`
2. `API_BASE_URL`
3. `http://localhost:3001`

`API_INTERNAL_ORIGIN` must be an absolute HTTPS URL (e.g., `https://<active-api-service-or-custom-domain>`). It must not be recursive (i.e. pointing to the proxy endpoint itself).

## Manual Dashboard Checks / Actions Remaining

### Vercel Production Settings:
1. `API_INTERNAL_ORIGIN` exists only if the real backend API origin is confirmed.
2. `API_INTERNAL_ORIGIN` must be an absolute HTTPS origin.
3. `API_INTERNAL_ORIGIN` must not be set to `https://www.craftmyfunnel.live/api/proxy`.

### Railway Settings:
1. Which backend API service is canonical and active.
2. Exact public/custom HTTPS origin for the API service.
3. Whether old `illustrious-warmth` contexts are stale and should be removed from required checks.

## Safety Notes

No DB, Prisma schema, migrations, Vercel/Railway secrets, OAuth scopes, Chrome permissions, PR #6, or UI changes were made in this audit.
