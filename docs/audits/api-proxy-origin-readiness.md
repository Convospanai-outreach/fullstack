# API Proxy Origin Readiness

Date: 2026-06-24
Agent: post-pr39-production-smoke-agent
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `6d012102ebfeff47e8a95cf72fda5955a76aee1e`

## Verdict

`API_INTERNAL_ORIGIN` cannot be resolved from repo config, public smoke, or unauthenticated production endpoints. The value must be confirmed manually from the active Railway/API dashboard or an approved custom API domain before setting production env.

Do not guess this value.

## Source Behavior

`apps/web/src/app/api/proxy/[...path]/route.ts` chooses the upstream origin in this order:

```ts
process.env["API_INTERNAL_ORIGIN"] || process.env["API_BASE_URL"] || "http://localhost:3001"
```

The route requires an absolute origin and includes a recursion guard that rejects targets where the upstream origin equals the web request origin and the target path starts with `/api/proxy`.

The route also has web-owned local route mappings for selected paths such as `/api/proxy/auth/*`, `/api/proxy/leads`, and `/api/proxy/leads/*/timeline`.

## Public Runtime Evidence

Production custom-domain checks used public Vercel DNS override because local DNS maps the custom domain to localhost.

| Endpoint | HTTP status | Body / behavior | What it proves |
| --- | --- | --- | --- |
| `/api/proxy` | 401 | `{"error":"Unauthorized"}` | Middleware blocks unauthenticated generic proxy access before upstream proxying |
| `/api/proxy/health` | 401 | `{"error":"Unauthorized"}` | Middleware blocks unauthenticated generic proxy access before upstream proxying |
| `/api/health` | 503 | Web readiness reports `database: down` | Production web readiness is not healthy |

`apps/web/src/proxy.ts` explains the 401 behavior: public API prefixes include specific public endpoints, but not generic `/api/proxy` or `/api/proxy/health`.

Because unauthenticated requests are blocked before generic proxy route handling, these smoke checks do not prove whether production `API_INTERNAL_ORIGIN` is missing, set, valid, or pointed at the canonical API service.

## Railway Evidence

Latest main `6d012102ebfeff47e8a95cf72fda5955a76aee1e` has green Railway statuses for:

- `airy-balance - convospan-api-split`
- `airy-balance - convospan-full-scaffold`
- `illustrious-warmth - convospan-api-split`
- `illustrious-warmth - convospan-full-scaffold`

The statuses say no deployment was needed because watched paths were not modified. They do not expose the canonical backend origin, custom domain, internal Railway service URL, or Vercel env value.

## Required Manual Checks

Before setting or validating production proxy behavior, confirm these dashboard values:

1. The active production API service that should receive web proxy requests.
2. The exact absolute backend origin for that service, preferably a stable custom API domain if one exists.
3. Whether the origin is reachable from Vercel production runtime.
4. Whether Vercel Production has `API_INTERNAL_ORIGIN` set exactly to that origin.
5. Whether any stale Railway services or duplicate projects should be disconnected from GitHub checks.

## Remaining Risks

- If `API_INTERNAL_ORIGIN` is absent, production web proxy calls may fall back to `http://localhost:3001`, which is not a valid Vercel production backend.
- If `API_INTERNAL_ORIGIN` points back to the web app, the route recursion guard should prevent recursive `/api/proxy` targets, but API-backed features will still fail.
- If `API_INTERNAL_ORIGIN` points to a stale Railway service, proxy-backed features can fail while deployment checks appear green.
- `/api/health` currently reports database readiness down, which may indicate env, connectivity, schema, or live DB readiness issues outside the proxy route itself.

## Safety Notes

This audit did not modify DB/schema/migrations, Prisma schema, Supabase production data, Vercel/Railway/Clerk/Redis env, PR #6, OAuth scopes, Chrome extension permissions, LinkedIn automation, packages, workflow config, production deployment config, or UI.
