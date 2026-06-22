# Post-Deploy Auth Session Smoke: c3cbfbf

Date: 2026-06-22
Agent: approval-readiness-agent
Status: NEEDS_REPLAN

## Deployment Identity

| Field | Value |
| --- | --- |
| Commit checked | `c3cbfbf48a353a3bf8ee1202b15cbb09e3f7632e` |
| Branch | `codex/db-linkage-swarm-orchestration` |
| Commit subject | `fix(auth): prevent public pages from triggering session runtime errors` |
| GitHub/Vercel commit status | `success` |
| Vercel status description | `Deployment has completed` |
| Vercel dashboard URL | `https://vercel.com/convo2026s-projects/fullstack-web-xkxn/9aMP16g26X1YQbi7nT5cdUDoShvA` |
| GitHub deployment ID | `5147717423` |
| GitHub deployment environment | `Preview` |
| Vercel preview URL | `https://fullstack-web-xkxn-gjs0zzkhv-convo2026s-projects.vercel.app` |

## Custom Domain Freshness

`www.craftmyfunnel.live` returned public `200` for `/security` and `/funnel` with `X-Vercel-Cache: PRERENDER` and low `Age`, but browser behavior does not match the expected `c3cbfbf` source fix.

Fresh Vercel runtime logs for the smoke window identify the custom-domain production deployment as:

| Field | Value |
| --- | --- |
| Deployment | `dpl_8rrycQGHzaBXXPCkLQK2dS2fxWYH` |
| Domain | `www.craftmyfunnel.live` |
| Environment | `production` |
| Branch | `main` |

Verdict: `c3cbfbf` has a successful Vercel preview deployment, but the custom production domain is still serving production `main` behavior and is not confirmed to be serving the `c3cbfbf` public-page session-free behavior.

## Public HTTPS Method

Local DNS maps the custom domains to `127.0.0.1`, so checks used public HTTPS with SNI/TLS and DNS override:

`--resolve www.craftmyfunnel.live:443:76.76.21.21`

## Browser Smoke Results

Chromium checked the public pages below. All rendered publicly and did not redirect to `/login`, but every checked page still requested both `/api/auth/session` and `/api/auth/_log`.

| Page | HTTP status | Final URL | Redirects to `/login` | Page renders | `/api/auth/session` requested | `/api/auth/_log` requested | Session request count | Console error count | 500/429 responses |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- |
| `/security` | `200` | `https://www.craftmyfunnel.live/security` | No | Yes | Yes | Yes | 1 | 3 | session `500`, `_log` `500` |
| `/support` | `200` | `https://www.craftmyfunnel.live/support` | No | Yes | Yes | Yes | 1 | 3 | session `500`, `_log` `500` |
| `/data-deletion` | `200` | `https://www.craftmyfunnel.live/data-deletion` | No | Yes | Yes | Yes | 1 | 3 | session `500`, `_log` `500` |
| `/google-api-disclosure` | `200` | `https://www.craftmyfunnel.live/google-api-disclosure` | No | Yes | Yes | Yes | 1 | 3 | session `500`, `_log` `429` |
| `/funnel` | `200` | `https://www.craftmyfunnel.live/funnel` | No | Yes | Yes | Yes | 1 | 3 | session `429`, `_log` `500` |
| `/help` | `200` | `https://www.craftmyfunnel.live/help` | No | Yes | Yes | Yes | 1 | 3 | session `500`, `_log` `429` |
| `/faq` | `200` | `https://www.craftmyfunnel.live/faq` | No | Yes | Yes | Yes | 1 | 3 | session `500`, `_log` `429` |

## Direct Auth Session Check

`https://www.craftmyfunnel.live/api/auth/session` returned:

| Field | Value |
| --- | --- |
| HTTP status | `500 Internal Server Error` |
| Content type | `application/json` |
| Body shape | `{ "message": "There is a problem with the server configuration. Check the server logs for more information." }` |
| Matched route | `X-Matched-Path: /api/auth/[...nextauth]` |
| Vercel cache | `MISS` |

## Runtime Log Evidence

Vercel runtime logs for project `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8`, environment `production`, query `NO_SECRET`, and the fresh smoke window showed:

- `/api/auth/session` `500`
- `/api/auth/_log` `500`
- NextAuth `NO_SECRET`
- Deployment `dpl_8rrycQGHzaBXXPCkLQK2dS2fxWYH`
- Domain `www.craftmyfunnel.live`
- Branch `main`

## Verdict

The public-page session-noise blocker is not resolved on the custom production domain. `c3cbfbf` is green as a Vercel preview deployment, but the custom domain still emits `/api/auth/session` and `/api/auth/_log` requests on public pages.

Direct `/api/auth/session` remains env-driven until `NEXTAUTH_SECRET` is added or fixed in the Vercel production environment for project `fullstack-web-xkxn`.

No source changes were made in this post-deploy smoke pass.
