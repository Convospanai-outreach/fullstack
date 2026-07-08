# Production Readiness PDCA After Render and Neon Cutover

## Status
Planning and evidence capture only.
No DB writes.
No migration execution.
No seed execution.
No env or secret access.
No app code changes.
Hosting cutover is COMPLETE.
API cutover is COMPLETE.
DB migration is COMPLETE.
Production readiness remains FINAL_SMOKE_PENDING.

## PLAN

### Current target architecture
- Vercel = web
- Render = `apps/api`
- Neon = Prisma Postgres DB
- Redis = cache/rate-limit/queue if configured
- Supabase = optional/non-Prisma only
- Railway = retired/safe to terminate

### Current confirmed status
- Hosting cutover COMPLETE
- API cutover COMPLETE
- DB migration COMPLETE
- Runtime DB connectivity PASS
- `API_INTERNAL_ORIGIN` now points to `https://fullstack-vz1l.onrender.com`
- Neon is the active Prisma DB target
- Supabase is not the active Prisma DB
- Railway is safe to terminate
- Neon migration evidence recorded:
  - branch `br-weathered-morning-a1swqggj`
  - compute `ep-rough-mud-a137oo29`
  - `25` Prisma migrations applied from `apps/web/prisma/schema.prisma`
  - `_prisma_migrations` exists with `25` records
  - `User`, `UserInvitation`, `ConnectedMailbox`, `EdgeNode`, `invite_requests`, and `_prisma_migrations` confirmed present by user evidence
- Latest post-migration runtime checks:
  - Render API ready: `200` healthy, database up
  - Vercel web ready: `200` healthy, database up

### Remaining production readiness risks
- Auth/session smoke test still needed
- Dashboard browser test still needed
- Critical app workflow smoke tests still needed
- Seed/config/default data validation still needed
- Email/provider integrations still need safe runtime verification
- Redis presence/absence must be classified
- Clerk auth path must be verified
- Authenticated proxy-to-Render proof is still needed
- No data-loss or destructive-migration verification beyond the completed migration evidence should be assumed
- EdgeNode should not be treated as fully green until runtime evidence exists
- PR #6 remains BLOCKED

## DO

### Manual browser smoke tests
1. Homepage loads.
2. Login/auth flow works.
3. Dashboard opens.
4. User creation/session mapping works.
5. Invite request path works or fails with a known missing provider/config issue.
6. Lead/campaign critical screen loads.
7. API-backed feature reaches Render.
8. No `5xx` appears in Vercel runtime logs during smoke.
9. No startup or runtime crashes appear in Render logs during smoke.
10. Neon table and migration proof is retained as the schema baseline.

### Safe curl checks
```bash
curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=live"
curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=ready"
curl.exe --ssl-no-revoke -i "https://fullstack-vz1l.onrender.com/health?probe=live"
curl.exe --ssl-no-revoke -i "https://fullstack-vz1l.onrender.com/health?probe=ready"
```

### Authenticated proxy proof requirement
- A signed-in browser action must show Render receiving expected API traffic, or equivalent application-level API success must be recorded.
- Do not treat an unauthenticated `401` on `/api/proxy/*` as sufficient proof for signed-in proxy forwarding.

## CHECK

| Check | PASS | PENDING | BLOCKED | FAIL | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| Vercel health | X |  |  |  | `https://www.craftmyfunnel.live/api/health?probe=ready` returned `200` healthy, database up |
| Render health | X |  |  |  | `https://fullstack-vz1l.onrender.com/health?probe=ready` returned `200` healthy, database up |
| Neon migration applied | X |  |  |  | `25` Prisma migrations applied from `apps/web/prisma/schema.prisma` |
| `_prisma_migrations` exists | X |  |  |  | User evidence says `_prisma_migrations` exists with `25` records |
| Core schema exists | X |  |  |  | `User`, `UserInvitation`, `ConnectedMailbox`, `EdgeNode`, `invite_requests`, and `_prisma_migrations` confirmed present |
| Supabase not active Prisma DB | X |  |  |  | Supabase is explicitly not the active Prisma target |
| Railway safe to terminate | X |  |  |  | API host moved to Render; Railway is retired pending confirmation |
| Browser login smoke |  | X |  |  | Signed-in browser verification still required |
| Dashboard smoke |  | X |  |  | Dashboard load and session mapping still need proof |
| Critical workflow smoke |  | X |  |  | Lead/campaign/invite-request workflows still need proof |
| Seed/config validation |  | X |  |  | Missing records or default config can still block app flows |
| Authenticated proxy-to-Render proof |  | X |  |  | Signed-in proof still required |
| Provider integrations |  | X |  |  | Email/provider paths still need safe runtime verification |
| Redis classification |  | X |  |  | Presence/absence and degraded-path behavior still need classification |
| Production readiness |  | X |  |  | PARTIAL PASS / FINAL SMOKE PENDING |

## ACT

### Next actions after smoke test
- If browser smoke passes: mark production readiness GREEN for beta.
- If auth fails: classify as Clerk/session/env mismatch.
- If dashboard fails with missing records: classify as seed/default config issue, not migration failure.
- If API-backed features fail: verify `API_INTERNAL_ORIGIN`, `NEXTAUTH_SECRET` parity, `CORS` / `ALLOWED_ORIGINS`, and Render logs.
- If DB-backed features fail despite health: verify model/table mismatch and Prisma client generation/deploy package.
- If provider feature fails: classify as provider/env missing, not DB failure.

## Non-goals
- No DB writes
- No migration execution
- No seed execution
- No env or secret access
- No app code changes
- No PR #6 unblock
- No EdgeNode production-execution green claim without explicit evidence
- No Supabase-as-Prisma-DB claim
- No Railway-as-active-API-host claim

## Current verdict
- Hosting + API + DB migration: COMPLETE
- Runtime checks: PASS
- Production readiness: PARTIAL PASS / FINAL SMOKE PENDING
- PR #6: BLOCKED
- EdgeNode: FINAL_SMOKE_PENDING
