# Production Health Database Down Root Cause Analysis

Date: 2026-06-24
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `d3bcbb3a12d7c184c0258cfaa0ea8cf5ab6fa8e8`

## Verdict

Verdict: `NEEDS_INPUT`.

Production liveness is healthy, but production readiness is unhealthy because the database check is down. The failure is not a source-code regression from the latest commit (which was docs-only). The root cause is likely a database connection/configuration issue on Vercel Production environment, pending dashboard and runtime logs verification.

## Endpoint Response Summary

| Endpoint | HTTP Status | Body Summary | Verdict |
| --- | --- | --- | --- |
| `/api/health?probe=live` | 200 | `{"status":"alive","probe":"liveness"}` | Liveness passes (process is running) |
| `/api/health?probe=ready` | 503 | `{"status":"unhealthy","probe":"readiness","checks":{"database":"down"}}` | Readiness fails (DB check down) |
| `/api/health` | 503 | `{"status":"unhealthy","probe":"readiness","checks":{"database":"down"}}` | Defaults to readiness in production |
| `/api/proxy/health` | 401 | `{"error":"Unauthorized"}` | Expected auth gate |

## Health Check Details

The readiness check dynamically imports `@/lib/db` and runs:
```ts
await prisma.$queryRaw`SELECT 1`;
```
Any database client or query execution error is caught and represented as `checks.database: "down"`.

## Possible Cause Classification

1. **Missing or Incorrect `DATABASE_URL` in Vercel Production**: If the variable is missing or points to the wrong host/port/database, Prisma cannot establish a connection.
2. **Database Network / Reachability Issue**: Supabase host might block Vercel runtime IPs, or connection timeouts occur.
3. **SSL/Connection Mode Mismatch**: Vercel serverless functions require pooled connection string format with appropriate SSL settings.

## Next Action Decision Tree

- **If `DATABASE_URL` is missing**: Add the correct production runtime `DATABASE_URL` in Vercel. Redeploy production and retest `/api/health?probe=ready`.
- **If `DATABASE_URL` points to the wrong DB**: Replace with the correct production Supabase/Postgres runtime URL. Redeploy production and retest readiness.
- **If DB URL is correct but connection times out**: Check Vercel to Supabase network/pooler/SSL settings. Confirm a serverless-compatible pooler URL is used. Do not run migrations.
- **If `API_INTERNAL_ORIGIN` is missing**: Treat it as an API proxy feature blocker, not the DB readiness blocker. Add it only after confirming the canonical Railway/custom API HTTPS origin.

## Human Action Required

1. Verify Vercel environment variables (`DATABASE_URL`, `DIRECT_URL`, `API_INTERNAL_ORIGIN`).
2. Verify Vercel production runtime logs for `/api/health?probe=ready` to identify the database error class.
3. Verify active Railway service and its custom/public HTTPS origin.
