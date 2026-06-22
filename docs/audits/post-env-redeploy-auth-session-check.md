# Post-Env-Redeploy Auth Session Check

Date: 2026-06-22
Agent: approval-readiness-agent
Status: Direct `/api/auth/session` blocker is RESOLVED. Direct session call no longer fails with `500` or `NO_SECRET` in runtime logs. Public pages still request session because production is serving branch `main`.

## Deployment Identity Verified

The latest Production deployment serving the custom domain was identified as:

| Field | Value |
| --- | --- |
| Deployment ID | `5147697018` |
| Serving Domain | `www.craftmyfunnel.live` |
| Environment | `Production` |
| Branch | `main` |
| Commit SHA | `4367d7bc374d4a6db9151b00bc40078fca1e2416` |
| Created Timestamp | `2026-06-22T07:27:20Z` |
| Updated/Redeployed | `2026-06-22T08:44:15Z` |

The update timestamp confirms that Vercel Production was successfully redeployed after the user updated the environment variables.

The current Codex branch (`codex/db-linkage-swarm-orchestration` at head `ef4eaf27d2796671927dfc68a082731547fd1d04`) remains a Preview-only deployment (ID `5148221224`).

## Direct Auth Session Verification

`GET https://www.craftmyfunnel.live/api/auth/session` over public HTTPS with SNI/TLS DNS bypass returned:

| Field | Value |
| --- | --- |
| HTTP Status | `200 OK` |
| Content-Type | `application/json` |
| Body | `{}` (empty object) |
| Matched Path Header | `X-Matched-Path: /api/auth/[...nextauth]` |
| Vercel Cache | `MISS` |

### Verdict: NextAuth `NO_SECRET` Resolved

Because `/api/auth/session` returns `200 OK` with an empty object (representing a valid, signed-out session state) instead of `500 Internal Server Error`, the NextAuth `NEXTAUTH_SECRET` environment variable is successfully active in Vercel Production. The runtime log `NO_SECRET` error is resolved.

## Public Page Client-Side Smoke

The following public trust/help pages were checked via public HTTPS SNI/TLS:

| Page | HTTP Status | Final URL | Redirects to `/login` | Page Renders | `/api/auth/session` Requested | `/api/auth/_log` Requested | 500/429 Responses |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/security` | `200` | `https://www.craftmyfunnel.live/security` | No | Yes | Yes | Yes | No (Returns 200) |
| `/support` | `200` | `https://www.craftmyfunnel.live/support` | No | Yes | Yes | Yes | No (Returns 200) |
| `/data-deletion` | `200` | `https://www.craftmyfunnel.live/data-deletion` | No | Yes | Yes | Yes | No (Returns 200) |
| `/google-api-disclosure` | `200` | `https://www.craftmyfunnel.live/google-api-disclosure` | No | Yes | Yes | Yes | No (Returns 200) |
| `/funnel` | `200` | `https://www.craftmyfunnel.live/funnel` | No | Yes | Yes | Yes | No (Returns 200) |
| `/help` | `200` | `https://www.craftmyfunnel.live/help` | No | Yes | Yes | Yes | No (Returns 200) |
| `/faq` | `200` | `https://www.craftmyfunnel.live/faq` | No | Yes | Yes | Yes | No (Returns 200) |

### Analysis

1. All pages successfully render without redirecting to `/login`.
2. All pages still make client-side requests to `/api/auth/session` and `/api/auth/_log`. This is because the custom domain is serving branch `main`, which does not contain the Codex source fix in `apps/web/src/app/providers.tsx`.
3. Unlike prior checks, these client-side calls no longer result in `500` or `429` responses because the NextAuth secret is active and the API endpoint responds with `200 OK`.
4. The client-side session-free source fix in the Codex branch is **NOT PROVEN ON PRODUCTION** because the custom domain is not yet serving the Codex branch.

## Status of `API_INTERNAL_ORIGIN`

- The user intentionally omitted `API_INTERNAL_ORIGIN` because the backend API URL is not yet confirmed.
- This missing variable does **NOT** block NextAuth session validation.
- It remains a blocker for API-backed features (e.g. `/api/proxy/*` or dashboard integrations), recorded as `NOT_SET_BY_USER; backend origin unknown`. API-backed feature readiness is marked as `NEEDS_INPUT`.

## Next Steps

1. Cherry-pick only the minimal `apps/web/src/app/providers.tsx` fix into branch `main` or merge a targeted PR.
2. Run full local checks (lint, typecheck, build) on `main` before deployment.
3. Verify that GitHub Actions run successfully.
