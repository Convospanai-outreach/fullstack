# Production Health Runtime Boundary Investigation

## Scope

Follow-up to PR #67 RCA.

## Evidence Before Change

- Current branch: `fix/web-health-runtime-boundary`
- Current `main` SHA: `1e991de3c74cad94437d537a0a8d35f0ce48836d`
- Production probe results before change:
  - `curl.exe --ssl-no-revoke -i https://www.craftmyfunnel.live/api/health` -> `500 Internal Server Error`
  - `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=ready"` -> `500 Internal Server Error`
  - `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=live"` -> `500 Internal Server Error`
- Vercel Ready status:
  - `vercel inspect https://www.craftmyfunnel.live` showed the custom domain mapped to a production deployment in `Ready` state
- Source files inspected:
  - `apps/web/src/app/api/health/route.ts`
  - `apps/web/src/proxy.ts`
  - `apps/web/src/app/api/proxy/[...path]/route.ts`
  - `apps/web/src/lib/db.ts`
  - `apps/web/src/lib/dbFactory.ts`
  - `apps/web/src/lib/redis.ts`
  - `apps/web/src/lib/rateLimit.edge.ts`
  - `apps/web/src/lib/rateLimit.ts`
  - `apps/web/src/lib/clerkAuth.ts`
  - `apps/web/src/lib/productFlags.ts`
  - `apps/web/tests/unit/health-route.test.ts`
  - `apps/web/package.json`
  - `apps/web/next.config.ts`

## Hypothesis

Likely failure boundary: middleware/proxy boundary.

Rationale:

- The health route itself has a no-I/O liveness branch and only imports Prisma inside the readiness branch.
- The app-wide proxy/middleware wraps all requests.
- The production error aggregation did not surface a clear serverless exception for `/api/health`.
- The safest next step is to remove `/api/health` from the proxy/auth/rate-limit path and make the health route explicitly Node/dynamic.

## Change Applied

Files changed:

- `apps/web/src/proxy.ts`
- `apps/web/src/app/api/health/route.ts`

Behavior change:

- `/api/health` is now bypassed before the proxy/auth/rate-limit work in `apps/web/src/proxy.ts`.
- `apps/web/src/app/api/health/route.ts` now declares:
  - `export const runtime = "nodejs"`
  - `export const dynamic = "force-dynamic"`

Why:

- This isolates the health probe from proxy/auth boundary failures.
- It keeps the liveness path no-I/O and prevents runtime mismatches from pushing the route to an edge execution path it does not need.
- It does not weaken auth for protected routes.

## Safety

- No secrets exposed
- No DB/schema/migration/env changes
- No production-ready claim
- No auth weakening outside the `/api/health` runtime boundary

## Verification

- `npm run typecheck --workspace apps/web` -> PASS
- `npm run lint --workspace apps/web` -> FAIL in the workspace lint wrapper with `JSON parse failed: EOF while parsing a value at line 1 column 0`
- Focused health-route unit test:
  - `npx vitest run tests/unit/health-route.test.ts` -> PASS
- What must be verified after deploy:
  - `curl.exe --ssl-no-revoke -i https://www.craftmyfunnel.live/api/health`
  - `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=live"`
  - `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=ready"`
  - confirm whether the 500 is gone and readiness still reports honestly if DB is down

## Verdict

YELLOW: route boundary isolated but production proof still pending

