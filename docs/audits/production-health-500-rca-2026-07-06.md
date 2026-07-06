# Production Health 500 RCA

## Scope

This is the follow-up to PDCA Cycle 2 RED.

## Evidence

- Current branch: `fix/production-health-500`
- Current `main` SHA: `63cd103`
- Production probe results before any fix:
  - `curl.exe --ssl-no-revoke -i https://www.craftmyfunnel.live/api/health` -> `500 Internal Server Error`
  - `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=ready"` -> `500 Internal Server Error`
  - `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=live"` -> `500 Internal Server Error`
- Vercel deployment / log availability:
  - `vercel inspect https://www.craftmyfunnel.live` worked and showed the custom domain mapped to a production deployment in `Ready` state
  - `vercel ls` worked and showed the latest production deployment as ready
  - `vercel logs https://www.craftmyfunnel.live --since 1h` timed out in CLI and did not yield a usable runtime error class
- Source files inspected:
  - `apps/web/src/app/api/health/route.ts`
  - `apps/web/src/proxy.ts`
  - `apps/web/src/app/api/proxy/[...path]/route.ts`
  - `apps/web/src/lib/db.ts`
  - `apps/web/src/lib/dbFactory.ts`
  - `apps/web/src/lib/redis.ts`
  - `apps/web/src/lib/rateLimit.edge.ts`
  - `apps/web/src/lib/rateLimit.ts`
  - `apps/web/tests/unit/health-route.test.ts`
  - `apps/web/package.json`
  - `apps/web/next.config.ts`
  - `scripts/readiness/check-db-shape.ts`
  - `scripts/readiness/check-migration-status.ts`

## Root Cause

Root cause not proven.

What is proven:

- The live production deployment is returning `500` for both liveness and readiness probes.
- The health route source itself has a fast liveness branch that returns before Prisma/DB I/O.
- The middleware/proxy layer wraps all requests and can influence `/api/health` before the route handler executes.

What is not yet proven:

- Whether the 500 is caused by the proxy wrapper, Clerk middleware, route import/runtime initialization, a deployment/runtime mismatch, or a separate infrastructure issue.
- Whether the canonical API origin or env configuration is still incomplete.
- Whether the failure occurs before the route handler or inside the handler boundary.

## Fix Applied

No runtime fix was applied.

I did not change `apps/web/src/app/api/health/route.ts`, `apps/web/src/proxy.ts`, Prisma schema, migrations, or env values because the failing path has not been proven yet.

## Post-Fix Verification

- Local typecheck/lint/test results: not run because no code fix was applied
- Production probe results if deployed and available:
  - still `500 Internal Server Error` on `/api/health`
  - still `500 Internal Server Error` on `/api/health?probe=ready`
  - still `500 Internal Server Error` on `/api/health?probe=live`
- `/api/health?probe=live` safety:
  - source code indicates the live branch is intended to be no-I/O
  - the production `500` means the request is failing before or around that branch, so the live path is not yet proven safe in production
- `/api/health?probe=ready` honesty:
  - readiness still returns `500`, so it is not honestly reporting a healthy DB state

## Verdict

RED: root cause/fix not proven

