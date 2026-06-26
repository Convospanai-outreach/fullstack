# Authenticated Proxy Verification Plan

Date: 2026-06-26
Branch: `docs/authenticated-proxy-verification-plan`
Repository: `Convospanai-outreach/fullstack`

## Verdict
- Infrastructure health is **green**.
- Product is **not production-ready**.
- Authenticated proxy-to-Railway forwarding still **needs verification**.

## Baseline and PR Status

| Item | Evidence | Status |
| --- | --- | --- |
| Latest `main` SHA | `cb22be7507dce017a0e0d257d3e55195bcc7bae2` | VERIFIED |
| PR #44 | Merged, security sequencing is on `main` | MERGED |
| PR #45 | Merged, functional readiness reassessment is on `main` | MERGED |
| PR #47 | Merged, green health checks recorded on `main` | MERGED |
| PR #48 | Merged, authenticated proxy verification plan on `main` | MERGED |

## Verified Green Health Evidence

The following endpoints have been confirmed as healthy and database connectivity is up:
- **Railway API `/health`**: `200 OK`, database `up`
- **Vercel web `/api/health`**: `200 OK`, database `up`
- **Vercel web `/api/health?probe=ready`**: `200 OK`, database `up` (17ms response)

## Current Proxy Behavior
- **Vercel `/api/proxy/health` (Unauthenticated)**: Returns `401 Unauthorized` with `{"error":"Unauthorized"}`.
- This is classified as **EXPECTED_AUTH_GATE** because the middleware protects all `/api/proxy/*` endpoints. An unauthenticated request cannot be forwarded to the backend API by design.

---

## Safe Verification Options

To verify that the proxy correctly forwards authenticated traffic to the Railway API without exposing secrets, weakening middleware security, or mutating production data, the following protocol is defined:

1. **Clerk Authenticated Smoke Test**:
   - Log into the production URL `https://craftmyfunnel.live` using a valid Clerk user account.
   - Open browser **DevTools** and select the **Network** tab.
   - Trigger a safe, read-only application action (such as loading the dashboard or settings list) that makes a request to `/api/proxy/...`.
   - Inspect the response and status code.
2. **DevTools Response Inspection**:
   - Verify that the browser request to `/api/proxy/...` returns `200 OK` (or the appropriate application response code) instead of `401 Unauthorized` or `500 Internal Server Error`.
3. **Upstream Log Verification**:
   - Query the Railway API dashboard runtime logs during the test window.
   - Confirm that an inbound request corresponding to the Vercel proxy's forward is recorded.
4. **Safety Boundaries**:
   - **Do not** use mutating endpoints (e.g., creating campaigns, deleting resources) for this check.
   - **Do not** bypass authentication checks or write code to expose authentication bypass headers.
   - **Do not** make `/api/proxy` public or modify `apps/web/src/proxy.ts` public allowlist rules.

---

## Pass and Fail Criteria

### What Counts as PASS
- The authenticated request successfully reaches the Vercel `/api/proxy` route.
- The Vercel proxy correctly resolves the internal destination using the configured Railway origin.
- The Vercel proxy forwards the request, and the Railway API returns the expected read-only data.
- No `API_INTERNAL_ORIGIN` resolution errors are logged.
- No recursive proxy routing loops or fetch failures (`fetch failed`) are observed.

### What Counts as FAIL
- The authenticated request still returns `401 Unauthorized` (indicating the session or request mapping failed to pass middleware).
- The Vercel proxy returns `500 Internal Server Error` (indicating an upstream resolution error or configuration issue).
- The request completes but no corresponding request is found in the Railway API logs.
- `API_INTERNAL_ORIGIN` is determined to be missing or invalid in the environment.
- The web application requests a wrong domain or an incorrect path suffix.

---

## Remaining Blockers

| Blocker | Description | Status |
| --- | --- | --- |
| Authenticated proxy forwarding | Proxy-to-Railway route traversal under active session | **NEEDS_VERIFICATION** |
| Clerk user/team linkage | Verification of Clerk-to-DB user sync | **NOT_VERIFIED** |
| Redis/cache isolation | Production vs Preview namespace isolation | **NOT_VERIFIED** |
| Supabase schema/migration proof | Read-only verification of database schema state | **NOT_VERIFIED** |
| PR #6 | Broad schema/env/docs changes overlap | **BLOCKED** |
| Stage 12A security gate | Minimum security audit/fixes for controlled beta | **NOT_STARTED** |
| Stage 12B security gate | Deep security hardening for public/enterprise launch | **NOT_STARTED** |
| Overall product readiness | System-wide verification is incomplete | **NOT_READY** |
