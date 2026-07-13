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
Production readiness remains FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH.

## Cycle 5 Checkpoint - 2026-07-13

PDCA Cycle 5: Security Risk Acceptance and Minimum Beta Gate.

Current substage: Stage 12A CHECK -> ACT remediation loop.

### PLAN

ADR correction is pending. PR #109 exists but is not approved because review findings remain.

### DO

Implementation PR #110 was opened and attempted the atomic API-key implementation.

### CHECK

CI is green enough to continue review, but security review failed. Current review identified blocking security and compatibility defects in PR #110, so CI must not be treated as Stage 12A proof.

### ACT

Freeze implementation, correct the architecture and source-of-truth docs, then merge PR #109, rebase PR #110, remediate implementation findings, run final-head review, and execute approved dynamic tenant, role, API-key, and failed-auth abuse tests.

Guardrails:

- no provider execution;
- no production DB mutation;
- no migration;
- no controlled-beta claim;
- no Stage 12B execution;
- no PR #6 unblock;
- no write-workflow promotion from page-load smoke.

Cycle status:

- Cycle 4 remains partially open because invite, lead-write, campaign-write/send, and other critical workflows are pending.
- Cycle 6 operational readiness has not started as an executable gate.
- Stage 12B is `VAPT_SCOPE_READY` only; execution has not started.

Overall status remains exactly:

`FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH`

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
- Supplied authenticated browser/proxy smoke evidence:
  - Clerk login: PASS
  - Clerk app-user sync: PASS
  - Dashboard page load: PASS
  - Settings page load: PASS
  - Leads page load with clean empty state: PASS
  - Campaigns page load with clean empty state: PASS
  - Authenticated Vercel proxy to Render: PASS
  - Proxy response decoding after PR #102: PASS

### Remaining production readiness risks
- Invite-request end-to-end workflow still pending
- Lead create/update/delete workflow still pending
- Campaign create/update/delete/send workflow still pending
- Default/seed/config completeness beyond observed clean empty states still pending
- Gmail/provider integrations still need safe runtime verification and remain security-gated
- LinkedIn integration remains security-gated
- NetjanaAI integration remains security-gated
- Real LLM usage remains security-gated
- Redis presence/absence must be classified
- Tenant/role abuse testing remains pending
- Stage 12A high finding remediation remains blocked/open
- Stage 12B/VAPT has not started
- No data-loss or destructive-migration verification beyond the completed migration evidence should be assumed
- EdgeNode should not be treated as fully green until runtime evidence exists
- PR #6 remains BLOCKED

## DO

### Manual browser smoke tests
1. Homepage loads.
2. Login/auth flow works. PASS by supplied evidence.
3. Clerk user/app sync works. PASS by supplied evidence.
4. Dashboard opens. PASS by supplied evidence.
5. Settings page opens. PASS by supplied evidence.
6. Leads page opens with clean empty state. PASS by supplied evidence.
7. Campaigns page opens with clean empty state. PASS by supplied evidence.
8. Authenticated API-backed page-load path reaches Render through the Vercel proxy. PASS by supplied evidence.
9. Proxy response decoding after PR #102 works. PASS by supplied evidence.
10. Invite request path remains pending.
11. Lead create/update/delete workflow remains pending.
12. Campaign create/update/delete/send workflow remains pending.
13. Provider-backed Gmail, LinkedIn, NetjanaAI, and real LLM workflows remain security-gated.
14. Neon table and migration proof is retained as the schema baseline.

### Safe curl checks
```bash
curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=live"
curl.exe --ssl-no-revoke -i "https://www.craftmyfunnel.live/api/health?probe=ready"
curl.exe --ssl-no-revoke -i "https://fullstack-vz1l.onrender.com/health?probe=live"
curl.exe --ssl-no-revoke -i "https://fullstack-vz1l.onrender.com/health?probe=ready"
```

### Authenticated proxy proof result
- A signed-in browser action or equivalent application-level API success is now recorded as PASS by supplied evidence.
- PR #102 proxy response decoding is recorded as PASS by supplied evidence.
- Do not treat this page-load/proxy proof as lead/campaign mutation proof, provider readiness, or Stage 12A security clearance.

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
| Browser login/auth smoke | X |  |  |  | Clerk login PASS by supplied evidence |
| Clerk user/app sync | X |  |  |  | Clerk app-user sync PASS by supplied evidence |
| Dashboard page load | X |  |  |  | Dashboard page load PASS by supplied evidence |
| Settings page load | X |  |  |  | Settings page load PASS by supplied evidence |
| Leads page clean empty state | X |  |  |  | Leads page load with clean empty state PASS by supplied evidence |
| Campaigns page clean empty state | X |  |  |  | Campaigns page load with clean empty state PASS by supplied evidence |
| Authenticated proxy-to-Render proof | X |  |  |  | Authenticated Vercel proxy to Render PASS by supplied evidence |
| Proxy response decoding after PR #102 | X |  |  |  | Proxy response decoding PASS by supplied evidence |
| Invite-request end-to-end workflow |  | X |  |  | Not yet proven |
| Lead write workflow |  | X |  |  | Create/update/delete not yet proven |
| Campaign write/send workflow |  | X |  |  | Create/update/delete/send not yet proven |
| Seed/config validation |  | X |  |  | Default/config completeness beyond observed clean states can still block app flows |
| Provider integrations |  |  | X |  | Gmail, LinkedIn, NetjanaAI, and real LLM workflows remain security-gated |
| Redis classification |  | X |  |  | Presence/absence and degraded-path behavior still need classification |
| EdgeNode production workflow |  | X |  |  | Runtime workflow remains FINAL_SMOKE_PENDING |
| Tenant/role abuse testing |  |  | X |  | Stage 12A dynamic abuse proof not yet run |
| Stage 12A high remediation |  |  | X |  | `STAGE_12A_BLOCKED_HIGH` remains open |
| Stage 12B/VAPT |  | X |  |  | Scope ready only; VAPT execution NOT_STARTED |
| Production readiness |  |  | X |  | FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH |

## ACT

### Next actions after page-load smoke reconciliation
- Treat core authenticated browser page-load smoke as PASS.
- Keep critical write/provider/security workflow readiness pending or blocked until separately proven.
- If auth fails: classify as Clerk/session/env mismatch.
- If dashboard fails with missing records: classify as seed/default config issue, not migration failure.
- If API-backed features fail: verify `API_INTERNAL_ORIGIN`, `NEXTAUTH_SECRET` parity, `CORS` / `ALLOWED_ORIGINS`, and Render logs.
- If DB-backed features fail despite health: verify model/table mismatch and Prisma client generation/deploy package.
- If provider feature fails: classify as provider/env missing, not DB failure.
- Do not claim controlled beta readiness until Stage 12A high findings are fixed or formally accepted and dynamic abuse tests pass.
- Do not claim public or enterprise readiness until Stage 12B/VAPT is complete.

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
- Core authenticated browser page-load smoke: PASS
- Critical write workflows: NOT_RUN / PENDING
- Provider workflows: SECURITY_GATE_PENDING / BLOCKED
- Stage 12A: BLOCKED_HIGH
- Stage 12B/VAPT: VAPT_SCOPE_READY only; execution NOT_STARTED
- Production readiness: FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH
- PR #6: BLOCKED
- EdgeNode: FINAL_SMOKE_PENDING
