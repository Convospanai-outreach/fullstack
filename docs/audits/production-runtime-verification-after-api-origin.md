# Production Runtime Verification After API Origin Update

Date: 2026-06-26
Branch: `docs/production-runtime-verification-api-origin`
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

## Vercel deployment inspected

| Field | Evidence |
| --- | --- |
| Vercel project | `fullstack-web-xkxn`, project ID `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` |
| Latest production deployment | `dpl_ARQQj8V2Cua47YgvSiRCaVEo4gZN` |
| Deployment URL | `fullstack-web-xkxn-40fi67iv6-convo2026s-projects.vercel.app` |
| Target | `production` |
| Ready state | `READY` |
| Created at | `2026-06-26T08:45:58.166Z` |
| GitHub deployment evidence | Deployment `5207759695`, environment `Production`, state `success`, created `2026-06-26T08:51:00Z` |
| Custom domain probed | `https://www.craftmyfunnel.live` via SNI/TLS DNS bypass to Vercel edge IP `76.76.21.21` because local DNS could not connect directly |

## Endpoint results

| Endpoint | Result | Interpretation |
| --- | --- | --- |
| `https://www.craftmyfunnel.live/api/health` | `200`, body `status: "healthy"`, `probe: "readiness"`, `checks.database: "up"` | Web production readiness endpoint now reports DB up. |
| `https://www.craftmyfunnel.live/api/health?probe=ready` | `200`, body `status: "healthy"`, `probe: "readiness"`, `checks.database: "up"` | Web production readiness is green for the current `SELECT 1` DB check. |
| `https://www.craftmyfunnel.live/api/health?probe=live` | `200`, body `status: "alive"`, `probe: "liveness"` | Web process liveness remains healthy. |
| `https://www.craftmyfunnel.live/api/proxy/health` | `401`, body `{"error":"Unauthorized"}` | Expected auth gate for the current proxy/auth design. Middleware does not public-allow `/api/proxy/health`, so unauthenticated requests do not prove upstream proxy forwarding. |
| `https://convospan-api-split-production.up.railway.app/health` | `200`, body `status: "healthy"`, `service: "craftmyfunnel-api"`, `checks.database: "up"`, `edge: "not_configured"`, `edgeRequired: false` | Public Railway API origin is reachable and API DB readiness is green. |
| `https://convospan-api-split-production.up.railway.app/health?probe=ready` | `200`, body `status: "healthy"`, `checks.database: "up"` | API readiness is green on the public Railway origin. |
| `https://convospan-api-split-production.up.railway.app/health?probe=live` | `200`, body `status: "alive"` | API liveness is healthy on the public Railway origin. |
| `https://convospan-api-split-production.up.railway.app/monitoring/health` | `503`, body `{"error":"Server misconfiguration"}` | Not used as the public API readiness proof; likely requires runtime auth/config path. |
| `https://convospan-api-split-production.up.railway.app/v1/system/health` | `503`, body `{"error":"Server misconfiguration"}` | Not used as the public API readiness proof; likely requires runtime auth/config path. |

## Runtime log summary

Vercel runtime logs were queried through the Vercel connector for production deployment `dpl_ARQQj8V2Cua47YgvSiRCaVEo4gZN` from `2026-06-26T07:41:54Z` to `2026-06-26T09:41:54Z`.

Observed:

- No `error` or `fatal` log entries were returned in the sampled query.
- One warning appeared for `GET /api/health 200`: hardware verification failed and the app ran in software-only mode.
- Targeted searches found no logs matching `API_INTERNAL_ORIGIN`, `recursive proxy`, `database`, or `fetch failed`.

This log review does not expose or verify the secret value of `API_INTERNAL_ORIGIN`; it only checks for runtime failure symptoms after the production redeploy.

## DB readiness result

DB readiness is now **green at the runtime health-check layer**:

- Web production `/api/health` and `/api/health?probe=ready` both return `200` with `checks.database: "up"`.
- Railway API `/health` and `/health?probe=ready` both return `200` with `checks.database: "up"`.

This is still only DB connectivity/readiness evidence. It is not a substitute for read-only Supabase schema/migration proof, tenant data linkage proof, or migration safety review.

## API proxy readiness result

API proxy readiness is **partially verified**:

- The confirmed public Railway API origin is live and healthy.
- Production `/api/proxy/health` returns `401 Unauthorized`, which matches the current middleware design because `/api/proxy/health` is not a public API prefix.
- No Vercel runtime logs in the sampled window indicate API origin errors, recursive proxy errors, database errors, or upstream fetch failures.

Remaining proxy proof:

- Verify an authenticated proxy-backed flow or a deliberately public non-mutating proxy health route in a future runtime smoke pass.
- Do not infer that the web proxy successfully forwarded to the upstream API from the unauthenticated `401` alone.

## Remaining blockers

| Blocker | Status after this pass |
| --- | --- |
| Supabase schema/migration proof | Still blocked; run read-only verifier with approved credentials/evidence path. |
| Prisma/live DB drift | Still blocked beyond the health `SELECT 1` checks. |
| Clerk user/team linkage | Still unproven against live data and current schema. |
| Redis/cache isolation | Still unverified for production/preview namespace isolation. |
| Protected/deep health | Still unverified; current pass only checked public health and unauthenticated proxy behavior. |
| Authenticated proxy-backed app flow | Still unproven; `/api/proxy/health` is auth-gated. |
| Feature completeness smoke | Still required for signup/login, teams, campaigns, leads, inboxes, settings, and core flows after infra blockers clear. |
| PR #6 | Still blocked and must not merge as-is. |
| Stage 12A minimum security gate | Not started; required before controlled beta. |
| Stage 12B deep security hardening | Not started; required before public/enterprise production. |

## Safety notes

This pass changed docs only. It did not change runtime code, DB schema, Prisma schema, migrations, Vercel/Supabase/Railway/Clerk/Upstash settings, OAuth scopes, Chrome extension permissions, PR #6, secrets, or env values.
