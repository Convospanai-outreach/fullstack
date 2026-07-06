# Production Health And API Origin Proof

## 1. Scope

This is PDCA Cycle 2 evidence capture after:

- Docker/GHCR/Trivy cleanup was merged
- the PDCA production-readiness plan was merged
- the latest `main` workflows were green at the time of capture

This document is evidence only. It does not claim production readiness.

## 2. Safety Constraints

- No production DB mutation
- No schema or migration changes
- No env or secrets changes
- No secrets printed
- No `PRODUCTION_READY` claim

## 3. Main Branch Evidence

- Current branch: `docs/production-health-api-origin-proof`
- Latest `main` SHA: `2387dc731e3a31cdc3a7455539506bb7e89be11d`
- `gh run list --branch main --limit 10` showed recent green runs for:
  - `CI`
  - `Production Readiness Gate`
  - `Vercel Parity Build`
  - `Phi-3 Verification`
  - `Push on main`
- `gh run list --branch main --workflow CodeQL --limit 1` showed `CodeQL` as `success`

Current main evidence is green for the workflows above, but that does not prove production health or API-origin correctness.

## 4. Production Health Endpoint Evidence

### `https://www.craftmyfunnel.live/api/health`

- Command used:
  - PowerShell-native `Invoke-WebRequest` probe timed out
  - Fallback diagnostic command: `curl.exe --ssl-no-revoke -i https://www.craftmyfunnel.live/api/health`
- HTTP status: `500 Internal Server Error`
- Response body: `Internal Server Error`
- Result: this does not prove liveness or readiness. It is a production health failure signal, not a healthy result.

### `https://www.craftmyfunnel.live/api/health?probe=ready`

- Command used:
  - PowerShell-native `Invoke-WebRequest` probe timed out
  - Fallback diagnostic command: `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=ready"`
- HTTP status: `500 Internal Server Error`
- Response body: `Internal Server Error`
- Result: this does not prove readiness. It is a production health failure signal, not a healthy result.

### Additional diagnostic probe

- `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=live"` also returned `500 Internal Server Error`
- That means the failure is not limited to database readiness; the liveness path is failing too

## 5. Vercel Env Presence Evidence

The Vercel CLI did not surface an inspectable key table in this terminal session, so the presence of these keys could not be confirmed from CLI output alone. Manual dashboard verification is still required.

| Key | Production | Preview | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `DIRECT_URL` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `POSTGRES_PRISMA_URL` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `POSTGRES_URL_NON_POOLING` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `API_INTERNAL_ORIGIN` | Manual dashboard value verification required | Manual dashboard value verification required | Presence and exact origin still need dashboard proof |
| `NEXTAUTH_URL` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `NEXT_PUBLIC_SITE_URL` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `NEXTAUTH_SECRET` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `CLERK_SECRET_KEY` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `SUPABASE_URL` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| `NEXT_PUBLIC_SUPABASE_URL` | Manual dashboard value verification required | Manual dashboard value verification required | CLI output did not expose an inspectable listing |
| Redis-related keys | Manual dashboard value verification required | Manual dashboard value verification required | Exact key names must be confirmed in dashboard |

## 6. API_INTERNAL_ORIGIN Decision Status

Requires manual dashboard confirmation of active Railway/custom API origin.

Do not infer the actual origin from code unless dashboard or runtime evidence proves it.

## 7. Source-Level Proxy/Health Review

- `API_INTERNAL_ORIGIN` is referenced in:
  - `apps/web/src/app/api/proxy/[...path]/route.ts`
  - `apps/web/src/app/api/extension/[...path]/route.ts`
  - `apps/web/src/modules/knowledge/services/knowledgeOrchestrator.ts`
  - `apps/web/src/lib/mcp/McpManager.ts`
  - `apps/api/src/modules/knowledge/services/knowledgeOrchestrator.ts`
- The proxy route validates that the origin is absolute and rejects recursive proxy loops when the target origin matches the web origin and the path starts with `/api/proxy`
- Public health exposure is controlled in `apps/web/src/proxy.ts`, which lists `/api/health` as a public API prefix
- The public health route is implemented in `apps/web/src/app/api/health/route.ts`
  - `probe=live` returns liveness without I/O
  - production default is readiness
  - readiness runs a dynamic Prisma import and `SELECT 1`
- The API-side monitoring helper exists in:
  - `apps/api/src/modules/monitoring/service/healthService.ts`
  - `apps/api/src/modules/monitoring/api/health.ts`
- The health check only proves database connectivity via `SELECT 1`
- It does not prove deep dependency readiness, proxy correctness, or a valid production API origin
- Evidence gap: the live production endpoint is currently returning `500`

## 8. Current Verdict

RED: production health/readiness failed or API origin is misconfigured

Do not claim production ready.

## 9. Required Next Action

If RED: create a focused fix plan/PR, but do not perform broad changes in this task.

The immediate follow-up should isolate why production `/api/health` and `/api/health?probe=live` return `500`, then separately confirm the canonical API origin in the dashboard without changing env values.

## 10. Evidence Appendix

- `git switch main; git pull --ff-only; git status --short`
  - main was already up to date
  - pre-existing unrelated helper files remained in the worktree and were left untouched
- `git rev-parse origin/main`
  - `2387dc731e3a31cdc3a7455539506bb7e89be11d`
- `gh run list --branch main --limit 10`
  - recent green runs for `CI`, `Production Readiness Gate`, `Vercel Parity Build`, `Phi-3 Verification`, and `Push on main`
- `gh run list --branch main --workflow CodeQL --limit 1`
  - `success`
- `Invoke-WebRequest` probes to `/api/health` and `/api/health?probe=ready`
  - timed out in PowerShell
- `curl.exe --ssl-no-revoke -i https://www.craftmyfunnel.live/api/health`
  - `500 Internal Server Error`
- `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=ready"`
  - `500 Internal Server Error`
- `curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=live"`
  - `500 Internal Server Error`
- `vercel env ls production`
- `vercel env ls preview`
  - the CLI did not surface an inspectable env table in this terminal session, so key presence remains unconfirmed here
