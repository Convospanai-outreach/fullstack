# Production Health Database Down Root Cause

Date: 2026-06-24
Agent: api-origin-health-readiness-agent
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `34c3339c280e0922567cc203b9edd3c435c073c1`

## Readiness Verdict

Verdict: `NEEDS_INPUT`.

Production liveness is healthy, but production readiness is unhealthy because the database check is down. The failure is not proven to be a source-code regression. The most likely class is Vercel Production database env/connectivity/target configuration, pending dashboard confirmation.

This audit does not claim production readiness.

## Live Endpoint Results

Production checks used public Vercel DNS override because local DNS maps `www.craftmyfunnel.live` to localhost:

```text
curl.exe --resolve www.craftmyfunnel.live:443:76.76.21.21 ...
```

| Endpoint | HTTP status | Body summary | Verdict |
| --- | --- | --- | --- |
| `/api/health` | 503 | `{"status":"unhealthy","probe":"readiness","checks":{"database":"down"}}` | readiness fails |
| `/api/health?probe=live` | 200 | `{"status":"alive","probe":"liveness"}` | liveness passes |
| `/api/health?probe=ready` | 503 | `{"status":"unhealthy","probe":"readiness","checks":{"database":"down"}}` | readiness fails |
| `/api/proxy/health` | 401 | `{"error":"Unauthorized"}` | expected auth gate before proxying |

## Health Implementation Summary

`apps/web/src/app/api/health/route.ts` implements two probe modes:

- `?probe=live` or `?probe=liveness`: returns fast process liveness with no downstream I/O.
- `?probe=ready` or `?probe=readiness`: checks database connectivity.
- no query param: defaults to readiness when `NODE_ENV === "production"` and liveness otherwise.

The readiness check dynamically imports `@/lib/db` and runs:

```ts
await prisma.$queryRaw`SELECT 1`;
```

It returns 200 only when that query succeeds. Any import/client/query error is swallowed and represented as `checks.database: "down"`.

## DB Env Variables Required

The readiness path depends on `apps/web/src/lib/db.ts`, which requires:

- `DATABASE_URL`: required for runtime Prisma/Postgres connectivity.

`DIRECT_URL` is used by Prisma migration/generation workflows, not by this runtime health query.

The DB client uses:

- `pg` Pool
- `@prisma/adapter-pg`
- connection timeout of 5 seconds
- production `DATABASE_URL` exactly as supplied
- local non-production replacement of `@localhost:` with `@127.0.0.1:`

## Cause Classification

| Possible cause | Current evidence | Classification |
| --- | --- | --- |
| Missing production `DATABASE_URL` | Possible, but not proven. Missing env would throw during DB client creation and be reported as `database: down`. | dashboard/env issue, needs input |
| Wrong production `DATABASE_URL` | Possible. A wrong host, password, database, pooler mode, SSL option, or stale Supabase target would fail `SELECT 1`. | dashboard/env issue, needs input |
| Unreachable database | Possible. The observed readiness duration around 1.4-1.5s indicates the route is doing runtime work, but the exact error is hidden by the endpoint. | env/network/DB issue, needs input |
| Prisma client generation issue | Less likely. GitHub `vercel-parity-build`, local web build, and local Prisma generation/build pass. A runtime import failure is still possible but not proven from public response. | lower-probability runtime/build issue |
| Schema drift | Unlikely for this specific health failure because the readiness query is only `SELECT 1` and does not reference app tables. Schema drift remains a separate blocker. | separate DB/schema blocker |
| Readiness endpoint requiring DB when liveness should not | Not a bug in source: liveness exists at `?probe=live`; production default intentionally uses readiness. Docker healthcheck currently calls `/api/health` and therefore uses DB readiness. | healthcheck configuration decision |
| Expected behavior because DB readiness is not configured | Yes, if Vercel Production `DATABASE_URL` is missing/wrong/unreachable. | needs dashboard input |

## Code vs Env vs DB Verdict

The best current classification is `NEEDS_INPUT`: production readiness is failing because the runtime database check cannot complete, and the exact cause requires dashboard/env/DB connectivity evidence that is not available from repo code or public endpoints.

No code change is recommended until the production `DATABASE_URL` target and DB reachability are confirmed. If container healthchecks only need liveness, update the deployment healthcheck path to `/api/health?probe=live` in a focused follow-up, but keep `/api/health?probe=ready` as the DB readiness gate.

## Manual Dashboard Values Needed

Confirm these without exposing secret values:

1. Vercel Production has `DATABASE_URL` present for the `fullstack-web-xkxn` project.
2. `DATABASE_URL` points to the intended production database/pooler for the canonical Supabase project.
3. The database host is reachable from Vercel production runtime.
4. SSL/pooler requirements match the Prisma `pg` adapter runtime.
5. `DIRECT_URL` is present only where migration workflows require it, and is not used as the web runtime health dependency.
6. Vercel runtime logs for `/api/health?probe=ready` show the concrete DB error class, redacted before sharing.
7. Any Docker/Railway web healthcheck uses `/api/health?probe=live` if it is meant to prove container liveness rather than DB readiness.

## Recommended Next Step

Use dashboard access to verify Vercel Production `DATABASE_URL` presence and target, then rerun:

```text
https://www.craftmyfunnel.live/api/health?probe=ready
```

Do not run migrations or write SQL as part of this check. If a read-only production verification tool is used later, it should use already-approved read-only procedures and redacted credentials.

## Safety Notes

No production DB connection was opened from this audit. No SQL, migrations, schema edits, Supabase production data changes, Vercel/Railway/Clerk/Redis env changes, secrets changes, PR #6 changes, security-check disabling, or production deployment changes were performed.
