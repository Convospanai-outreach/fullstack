# Frontend Auth Session Runtime Check

Date: 2026-06-22
Agent: approval-readiness-agent
Status: Source fix applied; production recheck required after deployment.

## Files Inspected

- `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/app/providers.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/layout/LayoutShell.tsx`
- `apps/web/src/components/support/SupportAssistant.tsx`
- `apps/web/src/proxy.ts`
- `apps/web/src/lib/rateLimit.edge.ts`

## Route Ownership

`/api/auth/session` is owned by the local Next.js web app, not the Fastify API proxy:

- Route file: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Handler: `NextAuth(authOptions)`
- Options source: `apps/web/src/lib/auth.ts`
- Public HTTP header evidence: `X-Matched-Path: /api/auth/[...nextauth]`

The route is not recursively targeting `/api/proxy`.

## Reproduction

Production checks used public HTTPS with SNI/TLS and DNS override:

`curl --resolve www.craftmyfunnel.live:443:76.76.21.21`

| URL | HTTP status | Relevant response/body |
| --- | --- | --- |
| `/api/auth/session` | `500` | JSON body: `{"message":"There is a problem with the server configuration. Check the server logs for more information."}` |
| `/security` | `200` | Page renders publicly |
| `/support` | `200` | Page renders publicly |
| `/data-deletion` | `200` | Page renders publicly |
| `/google-api-disclosure` | `200` | Page renders publicly |
| `/funnel` | `200` | Page renders publicly |

Chromium on the currently deployed production build reproduced repeated NextAuth client errors on `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, and `/funnel`:

- `Failed to load resource: the server responded with a status of 500`
- `[next-auth][error][CLIENT_FETCH_ERROR] ... /api/auth/session ...`

Earlier `429` responses are consistent with repeated browser polling and NextAuth client error logging hitting the auth endpoint rate limit.

## Runtime Log Evidence

Vercel runtime logs for project `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` showed `/api/auth/session` production `500` errors with NextAuth `NO_SECRET`.

This classifies the server-side route failure as env-driven: `NEXTAUTH_SECRET` is missing or not available in the production deployment that handled the request.

## Code-Driven Public Page Trigger

The public page noise was also code-driven. `apps/web/src/app/providers.tsx` mounted NextAuth `SessionProvider` on several fully public pages because the session-free allowlist did not include:

- `/security`
- `/support`
- `/data-deletion`
- `/google-api-disclosure`
- `/funnel`
- `/help`
- `/faq`

Those pages do not need NextAuth session polling.

## Fix Applied

`apps/web/src/app/providers.tsx` now includes the public trust/help/funnel routes in `sessionFreePrefixes`.

This is a narrow client-side fix: protected dashboard/app routes still mount `SessionProvider`, and no auth rules, Clerk behavior, OAuth scopes, database schema, or middleware protection were weakened.

## Local After-Fix Verification

After `npm run build --workspace apps/web`, a local production server was started on port `3010` and tested with Chromium.

| Route | Status | `/api/auth/session` browser requests | NextAuth console errors |
| --- | --- | --- | --- |
| `/security` | `200` | `0` | `0` |
| `/support` | `200` | `0` | `0` |
| `/data-deletion` | `200` | `0` | `0` |
| `/google-api-disclosure` | `200` | `0` | `0` |
| `/funnel` | `200` | `0` | `0` |

## Classification

- Env-driven: `NEXTAUTH_SECRET` missing/unavailable causes direct `/api/auth/session` `500`.
- Code-driven: public pages unnecessarily mounted `SessionProvider`, causing avoidable session calls.
- Rate-limit-driven: `429` was likely secondary noise from repeated auth/session and `/api/auth/_log` requests under the strict auth endpoint limit.
- DB-driven: not supported by the gathered evidence for signed-out public requests.

## Remaining Risk

Production still needs a post-deploy public smoke check. Direct `/api/auth/session` may still return `500` until `NEXTAUTH_SECRET` is present in the correct Vercel production environment, but public trust/funnel pages should no longer call it after this source fix is deployed.
