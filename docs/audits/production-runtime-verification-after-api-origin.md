# Production Runtime Verification After API Origin Update

Date: 2026-06-26
Updated: 2026-06-26T15:48+05:30
Branch: `docs/record-green-health-checks`
Repository: `Convospanai-outreach/fullstack`

## Verdict

CraftMyFunnel is **not production-ready** yet.

The production web health endpoints now report database readiness as green, and the confirmed public Railway API origin responds on its health endpoint. This is infrastructure/runtime progress only. It does not complete Supabase schema/migration proof, tenant/auth linkage proof, Redis isolation proof, protected deep-health verification, feature-completeness smoke, PR #6 decomposition, or the Stage 12A/12B security gates.

## Main and PR baseline

| Item | Evidence | Result |
| --- | --- | --- |
| Latest `main` SHA | `git rev-parse origin/main` returned `a827db43697297ed19bc7308b71aefc8c34ab901` | VERIFIED |
| PR #44 | Merged at `2026-06-26T07:53:59Z`, merge commit `6377dd3cc0d3179b58136aad7249cd9355910a20` | MERGED |
| PR #45 | Merged at `2026-06-26T08:45:55Z`, merge commit `a827db43697297ed19bc7308b71aefc8c34ab901` | MERGED |

## Confirmed Railway API origin

Use the public HTTPS Railway API origin:

```text
https://convospan-api-split-production.up.railway.app
```

Do **not** use Railway private internal DNS from Vercel. Do **not** use a `.railway.internal` URL in Vercel.

Evidence:

- GitHub commit status for latest `main` reports `airy-balance - convospan-api-split` success with description `Success - convospan-api-split-production.up.railway.app`.
- Direct public HTTPS health checks against the Railway origin return `200`.
- No secrets or environment variable values were inspected or printed.

## Vercel production domain tested

| Field | Value |
| --- | --- |
| Domain | `craftmyfunnel.live` |
| Vercel project | `fullstack-web-xkxn`, project ID `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` |
| Latest production deployment | `dpl_ARQQj8V2Cua47YgvSiRCaVEo4gZN` |
| Deployment URL | `fullstack-web-xkxn-40fi67iv6-convo2026s-projects.vercel.app` |
| Target | `production` |
| Ready state | `READY` |
| Created at | `2026-06-26T08:45:58.166Z` |
| GitHub deployment evidence | Deployment `5207759695`, environment `Production`, state `success`, created `2026-06-26T08:51:00Z` |

## Endpoint results

| # | Endpoint | HTTP | Body summary | Interpretation |
| --- | --- | --- | --- | --- |
| 1 | `GET https://convospan-api-split-production.up.railway.app/health` | `200` | `status: "healthy"`, `probe: "readiness"`, `service: "craftmyfunnel-api"`, `database: "up"`, `edge: "not_configured"`, `edgeRequired: false` | **PASS** — Railway API public origin is reachable and healthy; DB readiness is green. |
| 2 | `GET https://craftmyfunnel.live/api/health` | `200` | `status: "healthy"`, `probe: "readiness"`, `service: "craftmyfunnel-web"`, `database: "up"`, `durationMs: 602` | **PASS** — Vercel web readiness endpoint reports DB connectivity up. |
| 3 | `GET https://craftmyfunnel.live/api/health?probe=ready` | `200` | `status: "healthy"`, `probe: "readiness"`, `service: "craftmyfunnel-web"`, `database: "up"`, `durationMs: 17` | **PASS** — Explicit readiness probe is green. |
| 4 | `GET https://craftmyfunnel.live/api/proxy/health` | `401` | `{"error":"Unauthorized"}` | **EXPECTED_AUTH_GATE** — Proxy route is auth-protected by middleware. Unauthenticated `401` does not prove or disprove upstream forwarding. |

### Railway `/health` full response

```json
{
  "status": "healthy",
  "probe": "readiness",
  "service": "craftmyfunnel-api",
  "database": "up",
  "edge": "not_configured",
  "edgeRequired": false,
  "edgeError": "Optional edge runtime is not configured. Cloud fallback remains active."
}
```

### Vercel `/api/health` full response

```json
{
  "status": "healthy",
  "probe": "readiness",
  "service": "craftmyfunnel-web",
  "database": "up",
  "durationMs": 602
}
```

### Vercel `/api/health?probe=ready` full response

```json
{
  "status": "healthy",
  "probe": "readiness",
  "service": "craftmyfunnel-web",
  "database": "up",
  "durationMs": 17
}
```

### Vercel `/api/proxy/health` full response

```json
{
  "error": "Unauthorized"
}
```

## Interpretation

- Railway API public origin `https://convospan-api-split-production.up.railway.app` is **confirmed reachable and healthy**.
- Railway API database connectivity is **up** (Prisma `SELECT 1` check).
- Vercel web production domain `craftmyfunnel.live` is **healthy** with database connectivity **up**.
- Vercel readiness probe responds in **17ms**, indicating healthy warm state.
- Vercel proxy returns **401 Unauthorized** because `/api/proxy/health` is auth-protected by middleware design. This is **expected behavior for unauthenticated requests**, not a broken proxy.
- This result does **not** prove that authenticated Vercel proxy-to-Railway forwarding works. That requires a separate authenticated request test.

## DB readiness result

DB readiness is now **green at the runtime health-check layer**:

- Web production `/api/health` and `/api/health?probe=ready` both return `200` with `checks.database: "up"`.
- Railway API `/health` returns `200` with `database: "up"`.

This is still only DB connectivity/readiness evidence (`SELECT 1`). It is not a substitute for read-only Supabase schema/migration proof, tenant data linkage proof, or migration safety review.

## API proxy readiness result

API proxy readiness is **partially verified**:

- The confirmed public Railway API origin is live and healthy.
- Production `/api/proxy/health` returns `401 Unauthorized`, which matches the current middleware design because `/api/proxy/health` is not a public API prefix.

Remaining proxy proof:

- Verify an authenticated proxy-backed flow or a deliberately public non-mutating proxy health route in a future runtime smoke pass.
- Do not infer that the web proxy successfully forwarded to the upstream API from the unauthenticated `401` alone.

## Remaining blockers

| # | Blocker | Status after this pass |
| --- | --- | --- |
| 1 | Authenticated proxy-to-Railway forwarding | Still needs verification with an authenticated request or deliberately public proxy route. |
| 2 | Clerk user/team linkage | Still unproven against live data and current schema. |
| 3 | Redis/cache isolation | Still unverified for production/preview namespace isolation. |
| 4 | Supabase schema/migration proof | Still blocked; run read-only verifier with approved credentials/evidence path. |
| 5 | Prisma/live DB drift | Still blocked beyond the health `SELECT 1` checks. |
| 6 | Protected/deep health | Still unverified; current pass only checked public health and unauthenticated proxy behavior. |
| 7 | Feature completeness smoke | Still required for signup/login, teams, campaigns, leads, inboxes, settings, and core flows after infra blockers clear. |
| 8 | PR #6 | Still blocked and must not merge as-is. |
| 9 | Stage 12A minimum security gate | Not started; required before controlled beta. |
| 10 | Stage 12B deep security hardening | Not started; required before public/enterprise production. |

## Overall readiness verdict

| Dimension | Status |
| --- | --- |
| Railway API origin | **PASS** |
| Railway API DB health | **PASS** |
| Vercel web DB health | **PASS** |
| Vercel readiness probe | **PASS** |
| Vercel proxy unauthenticated behavior | **EXPECTED_AUTH_GATE** |
| Authenticated proxy forwarding | **NEEDS_AUTHENTICATED_VERIFICATION** |
| Clerk user/team linkage | **NOT_VERIFIED** |
| Redis/cache isolation | **NOT_VERIFIED** |
| Supabase schema/migration proof | **NOT_VERIFIED** |
| PR #6 | **BLOCKED** |
| Stage 12A security gate | **NOT_STARTED** |
| Stage 12B security gate | **NOT_STARTED** |
| Overall product readiness | **NOT_READY** |

## Safety notes

This pass changed docs only. It did not change runtime code, DB schema, Prisma schema, migrations, Vercel/Supabase/Railway/Clerk/Upstash settings, OAuth scopes, Chrome extension permissions, PR #6, secrets, or env values.
