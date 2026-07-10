# Stage 12A Minimum Security Gate

## Executive Verdict

STAGE_12A_BLOCKED_HIGH

Stage 12A is not cleared for controlled beta. No confirmed `CRITICAL` issue was proven in this passive audit, but multiple `HIGH` minimum-gate blockers remain: raw API key storage/lookup, legacy dashboard mutation routes without route-local tenant ownership, mass-assignment patterns, incomplete sensitive-list bounds, provider-adjacent webhook proof gaps, and AI cache/rate-limit tenant-scope gaps.

## Baseline

| Item | Evidence |
| --- | --- |
| Workspace | `D:\convo\fullstack-stage12a` |
| Branch | `docs/stage-12a-minimum-security-gate-2026-07-10` |
| Baseline commit | `e071e5ecd74e1dfc0fe7bc0df727dd9d7fbc7169` |
| Origin main | `e071e5ecd74e1dfc0fe7bc0df727dd9d7fbc7169` |
| Current architecture | Vercel web, Render API, Neon Prisma Postgres, Clerk auth, Redis optional/degraded-capable; Supabase not active Prisma DB; Railway retired/safe to terminate |
| Safety boundary | No migrations, seeds, DB writes, provider calls, Gmail OAuth, LinkedIn actions, NetjanaAI calls, LLM calls, env/secret reads, schema edits, or deployment setting changes |

## Functional Readiness Carried Forward

The supplied baseline is carried forward as `FUNCTIONAL_SMOKE_PASS / STAGE_12A_SECURITY_PENDING`:

- Vercel web health, Render API health, and Neon migration are PASS.
- Clerk login and clerk-sync are PASS.
- Dashboard, settings, leads, and campaigns smoke are PASS.
- Authenticated Vercel proxy to Render is PASS after PR #102.
- No production 5xx was observed during the latest verification window.

These results do not clear controlled beta because Stage 12A still has high blockers and missing dynamic tenant-abuse proof.

## Route Inventory Summary

Static inventory covered `apps/web/src/app/api/**`, `apps/api/routes/**`, `apps/api/src/modules/**`, `apps/api/src/workers/**`, shared auth/request-context/permission/rate-limit libraries, package scripts, CI workflows, and existing security/readiness docs.

| Metric | Result |
| --- | --- |
| Handler exports enumerated | 426 route-handler method exports |
| Existing test files found | 61 route/module/e2e/unit/integration test files |
| Direct API global auth evidence | `apps/api/server.ts:153-193` |
| Web proxy auth/rate-limit evidence | `apps/web/src/proxy.ts:111-224` |
| Internal proxy signature evidence | `apps/web/src/app/api/proxy/[...path]/route.ts:77-117` |

Route inventory table:

| Route | Method | File | Auth required | Auth mechanism | Team scope required | Team membership verified server-side | Resource ownership verified | Role enforced server-side | Mutable-field allowlist | Input validation | Rate limit | Pagination/bounds | Raw SQL or dynamic query | JWT/session/internal-signature validation | Sensitive response fields | Test exists | Severity | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| API adapter non-public routes | ALL | `apps/api/server.ts` | Yes | NextAuth token or internal HMAC | Context only | Needs route-level proof | Needs route-level proof | Admin prefix only | Route-level | Route-level | Partial | Route-level | Partial | `getToken` + `verifyInternalAuthHeaders` | Route-level | Partial | MEDIUM | NEEDS_VERIFICATION | `apps/api/server.ts:153-193` |
| API adapter public prefixes | ALL | `apps/api/server.ts` | Mixed | Public allowlist | Route-level | Route-level | Route-level | Route-level | Route-level | Route-level | Route-level | Route-level | Route-level | Public path bypasses adapter token check | Route-level | Partial | HIGH | NEEDS_VERIFICATION | `/webhooks`, `/auth`, `/register`, `/health`, `/metrics`, `/scheduler`, Google callback/pubsub are public at `apps/api/server.ts:153-164` |
| Web app proxy | ALL | `apps/web/src/proxy.ts` | Yes except allowlists | Clerk + NextAuth token | Path/context | Needs route-level proof | Needs route-level proof | Admin/CMS page gates | Route-level | Route-level | Yes at proxy | Route-level | No | Clerk/NextAuth | Route-level | Partial | MEDIUM | NEEDS_VERIFICATION | `apps/web/src/proxy.ts:53-58`, `apps/web/src/proxy.ts:111-143`, `apps/web/src/proxy.ts:211-224` |
| Upstream proxy | ALL | `apps/web/src/app/api/proxy/[...path]/route.ts` | Yes through proxy | Clerk app user or NextAuth token converted to HMAC | Forwarded context | Needs upstream proof per route | Needs upstream proof per route | Upstream route-level | Route-level | Route-level | Proxy-level via `apps/web/src/proxy.ts` | Route-level | No | HMAC timestamp/signature | Response headers sanitized | PR #102 coverage implied | LOW | PASS | HMAC at `apps/web/src/app/api/proxy/[...path]/route.ts:77-117`; sanitized response headers at `:11-35` |
| `/governance/keys` | GET/POST | `apps/api/routes/governance/keys/route.ts` | Yes | `getCurrentContext` | Yes | Yes via `teamId` | Team-scoped key query | ADMIN | Partial | Missing schema for `name` | Proxy/global only | No explicit page size | No | Session context | Full key object on POST | No direct test found | HIGH | FAIL | Admin check at `:10-15`; raw key created/stored/returned at `:55-67` |
| `/settings/keys` | GET/POST/DELETE | `apps/api/routes/settings/keys/**` | Yes | `getCurrentContext` | Yes | Yes | Team-scoped | ADMIN | Partial | Missing schema for `name/scopes` | Proxy/global only | No explicit page size | No | Session context | Full key returned once | No direct test found | HIGH | FAIL | Client-supplied scopes at `apps/api/routes/settings/keys/route.ts:36-47`; full key returned at `:59` |
| API-key validation | N/A | `apps/api/src/lib/apiAuth.ts` | API key | `x-api-key` | Yes by key record | Key-derived only | Key-derived only | Scope string only | N/A | N/A | Used by v1 route limit | N/A | No | Raw key lookup | API key is stored as lookup secret | No direct test found | HIGH | FAIL | Raw lookup by key at `apps/api/src/lib/apiAuth.ts:4-13`; last-used write at `:23-27` |
| `/dashboard/campaigns/:id` | PATCH/DELETE | `apps/api/routes/dashboard/campaigns/[id]/route.ts` | Adapter-level only | NextAuth/internal HMAC through API adapter | Missing in route | Not visible | ID-only mutation | Missing | Missing | Missing | Proxy/global only | N/A | No | Adapter only | Campaign record | No direct test found | HIGH | FAIL | `data: body` and `where: { id }` at `apps/api/routes/dashboard/campaigns/[id]/route.ts:4-17` |
| `/dashboard/activities` | GET/POST | `apps/api/routes/dashboard/activities/route.ts` | Adapter-level only | NextAuth/internal HMAC through API adapter | Missing in route | Not visible | Missing | Missing | Missing | Missing | Proxy/global only | `take: 100` on GET | No | Adapter only | Activity records | No direct test found | HIGH | FAIL | Unscoped list/create at `apps/api/routes/dashboard/activities/route.ts:4-12` |
| `/v1/leads` | GET/POST | `apps/api/routes/v1/leads/route.ts` | Yes | API key plus adapter token unless public routing changes | Yes | Key-derived team | List scoped by `auth.teamId` | Scope string | Partial | Basic only | API-key rate limit | Uncapped `limit` | Dynamic Prisma filters | API key + adapter | Lead PII | No direct test found | HIGH | FAIL | Unbounded `limit` at `:16-18`; spread body at `:76-81` |
| `/v1/leads/:id` | GET/PATCH/DELETE | `apps/api/routes/v1/leads/[id]/route.ts` | Yes | API key plus adapter token unless public routing changes | Yes | Key-derived team | Uses `id` + `teamId` | Scope string | Partial denylist | Missing schema | API-key rate limit | Email include `take: 5` | Dynamic Prisma | API key + adapter | Lead/email data | No direct test found | HIGH | FAIL | Body update after deleting only `id` and `teamId` at `:50-60`; needs strict allowlist |
| `/webhooks` | GET/POST | `apps/api/routes/webhooks/route.ts` | Yes in route despite adapter public prefix | Session context | Yes | Yes | Team-scoped list/create | Missing role proof | Partial | Zod schema | Public/proxy webhook rate limit only | No explicit page size | No | Session context | Webhook secret returned in create response risk | No direct test found | HIGH | NEEDS_VERIFICATION | Webhook secret created and returned in response object at `apps/api/routes/webhooks/route.ts:44-53` |
| `/webhooks/netjana-intel` | POST | `apps/api/routes/webhooks/netjana-intel/route.ts` | Yes | API key and optional HMAC | Yes | API-key derived | Team passed to ingest | Scope string | N/A | Custom payload validator | Missing explicit rate limit | N/A | No | API key; HMAC only if secret exists | Signal IDs/status | No direct test found | HIGH | NEEDS_VERIFICATION | HMAC skipped when no secret at `:33-47`; provider remains gated |
| `/webhooks/scraper-ingest` | POST | `apps/api/routes/webhooks/scraper-ingest/route.ts` | Yes | HMAC secret | Payload-derived region/job | No team proof visible | Job ID from body | Missing role | Partial | JSON parse plus Sentinel | Missing explicit route limit | N/A | No | HMAC + timestamp | Error message returned | No direct test found | HIGH | NEEDS_VERIFICATION | Body-selected `jobId`/URL at `:73-100`; error detail at `:111-114` |
| `/integrations/google/pubsub` | POST | `apps/api/routes/integrations/google/pubsub/route.ts` | Yes | Verification token | Mailbox handler-dependent | Needs service proof | Handler-dependent | N/A | N/A | Zod schema | Missing explicit route limit | N/A | No | Token header/query | Error message returned | No direct test found | HIGH | NEEDS_VERIFICATION | Public adapter path plus token verification at `apps/api/routes/integrations/google/pubsub/route.ts:14-36` |
| `/ai/execute` | POST | `apps/api/routes/ai/execute/route.ts` | Yes | NextAuth + current context | Yes | Context-derived | Needs per-action proof | Missing per-action role | Partial | Action-specific only | Missing explicit route limit | N/A | No | Session | AI output | No direct test found | HIGH | NEEDS_VERIFICATION | Team override blocked at `:21-29`; untyped action dispatch at `:32-89` |
| Semantic LLM cache | N/A | `apps/api/src/modules/optimization/SemanticCache.ts` | Caller-dependent | Caller-dependent | Missing | Missing | Global prompt hash | N/A | N/A | N/A | N/A | N/A | `$queryRawUnsafe` with params | N/A | Cached AI response | No direct test found | HIGH | NEEDS_VERIFICATION | Global cache lookup by prompt hash at `:18-28`; semantic query at `:63-74`; no team key in cache APIs |
| Razorpay webhook | POST | `apps/api/routes/webhooks/razorpay/route.ts` | Yes | HMAC | Body notes | No membership, provider signature trusted | Payment note `teamId` trusted after signature | N/A | N/A | Provider payload parse | Missing explicit route limit | N/A | No | HMAC timing compare | Payment IDs | No direct test found | MEDIUM | NEEDS_VERIFICATION | Credits increment from signed notes at `apps/api/routes/webhooks/razorpay/route.ts:33-65` |
| Public health | GET | `apps/web/src/app/api/health/route.ts`, `apps/api/routes/health/route.ts` | No | Intentionally public | N/A | N/A | N/A | N/A | N/A | N/A | Web proxy public rate limit | N/A | `SELECT 1` | N/A | DB up/down only | Health tests exist | LOW | PASS | Public liveness/readiness intentionally exposed |

## Critical Findings

None confirmed in this passive Stage 12A pass. Active IDOR, role-abuse, CSRF, SSRF, provider, and prompt-injection tests remain unrun.

## High Findings

### S12A-HIGH-001: API keys are stored and looked up as raw reusable secrets

- Evidence: `apps/api/routes/governance/keys/route.ts:55-67`, `apps/api/routes/settings/keys/route.ts:36-59`, `apps/api/src/lib/apiAuth.ts:4-13`.
- Impact: DB read exposure could become live API access; broad client-selected scopes are not safely allowlisted.
- Required fix: hash stored keys, return raw key once, enforce scope allowlists, rotate old keys, add tests.

### S12A-HIGH-002: Legacy dashboard mutation routes lack route-local tenant ownership

- Evidence: `apps/api/routes/dashboard/campaigns/[id]/route.ts:4-17`, `apps/api/routes/dashboard/activities/route.ts:4-12`.
- Impact: authenticated callers may mutate or list tenant data by bare ID if these routes are reachable.
- Required fix: delete deprecated duplicates or add `getCurrentContext`, team membership, `where: { id, teamId }`, schemas, and IDOR tests.

### S12A-HIGH-003: Mass-assignment patterns remain in mutation paths

- Evidence: `data: body` and broad spread patterns in `apps/api/routes/v1/leads/route.ts:76-81`, `apps/api/routes/v1/leads/[id]/route.ts:50-60`, `apps/api/routes/dashboard/campaigns/[id]/route.ts:7-10`, `apps/api/routes/dashboard/activities/route.ts:9-12`, `apps/api/routes/governance/guardrails/route.ts:61`.
- Impact: future sensitive fields can become writable accidentally.
- Required fix: zod strict schemas and positive `data` construction for all tenant, billing, provider, campaign, lead, and settings mutations.

### S12A-HIGH-004: Sensitive list endpoints need explicit caps and pagination proof

- Evidence: `/v1/leads` parses uncapped `limit` at `apps/api/routes/v1/leads/route.ts:16-18`; governance key and webhook list routes lack explicit pagination caps.
- Impact: PII/key metadata/log enumeration and high-cost DB queries are easier to abuse.
- Required fix: default limits, hard max caps, non-negative validation, team scope, and tests.

### S12A-HIGH-005: Provider-adjacent webhooks and automation routes need pre-provider proof

- Evidence: `apps/api/routes/webhooks/netjana-intel/route.ts:33-47`, `apps/api/routes/webhooks/scraper-ingest/route.ts:73-114`, `apps/api/routes/integrations/google/pubsub/route.ts:14-36`, `apps/api/routes/linkedin-runner/run/route.ts:1`.
- Impact: forged or replayed callbacks can mutate data or trigger expensive work if misconfigured.
- Required fix: required signatures in production, replay nonce storage, payload-size caps, route limits, and provider-abuse tests.

### S12A-HIGH-006: AI cache and AI execution need tenant-isolation/rate-limit proof

- Evidence: `/ai/execute` enforces current team at `apps/api/routes/ai/execute/route.ts:21-29`; prompt policy exists at `apps/api/src/lib/aiInputGuardrails.ts:62-110`; credit reservation exists at `apps/api/src/lib/aiService.ts:189-204`; semantic cache lacks a visible team dimension at `apps/api/src/modules/optimization/SemanticCache.ts:18-28` and `:63-74`.
- Impact: one tenant could receive content derived from another tenant's prompt/output, or expensive model calls may be abused.
- Required fix: team-scoped AI cache keys/queries, route rate limits, prompt/tool isolation tests.

## Medium Findings

- CSRF posture for cookie-authenticated mutations remains incomplete and should be addressed in Stage 12B unless an immediate exploit path is proven.
- Public operational status should remain minimal; detailed dependency status belongs behind admin/private access.
- CSP hardening remains Stage 12B work, including reduction of inline/eval allowances where feasible.

## Low Findings

- Static search found docs/CI placeholder URLs and keys; no live secret value was intentionally accessed or printed.
- PII log minimization remains a Stage 12B hardening topic.

## Needs Verification

- Team A vs Team B IDOR proof requires two safe test tenants.
- Member vs admin/owner proof requires role-varied safe accounts.
- Runtime Redis presence and multi-instance rate-limit behavior remain `UNKNOWN_NEEDS_ENV_CONFIRMATION`.
- Vercel/Render runtime logs were not queried in this pass.
- Provider routes and real LLM calls were not executed by design.

## Authentication Coverage

The direct Render API has a shared adapter gate for non-public routes (`apps/api/server.ts:153-193`). The web app proxy has Clerk/NextAuth auth gating and rate limiting (`apps/web/src/proxy.ts:111-224`). Coverage is not sufficient for Stage 12A until public-prefix exceptions, API-key routes, webhooks, provider callbacks, and legacy dashboard routes have route-level proof.

## Tenant Isolation and IDOR

Core routes show some team scoping, but legacy dashboard routes mutate by bare ID and dynamic Team A vs Team B tests were not run.

## Role and Ownership Enforcement

Role helpers are present, including `authorizeRole`, `checkTeamPermission`, and API adapter admin-prefix enforcement. Full proof is still missing for settings, provider, billing, import/export, API-key, connected mailbox, and campaign-execution paths.

## Mass Assignment

Stage 12A is blocked by broad request body mutation patterns. Strict schemas and explicit allowlists are required.

## Rate Limiting

Rate-limit infrastructure exists in `apps/web/src/proxy.ts`, `apps/api/src/lib/rateLimit.ts`, and selected API-key/webhook routes. Coverage is incomplete for AI/provider/import/export/settings mutation routes.

## Raw SQL and Query Safety

Parameterized `$queryRaw` appears in health checks. `$queryRawUnsafe` and `$executeRawUnsafe` appear in vector/cache modules, notably `apps/api/src/modules/optimization/SemanticCache.ts`; bound parameters are used for vector values, but tenant scoping still needs review.

## JWT, Session and Internal Authentication

Internal proxy signing uses HMAC with timestamp in `apps/web/src/app/api/proxy/[...path]/route.ts:77-117`; Render-side verification is in `apps/api/server.ts:168-183`. Replay protection is timestamp-based; nonce storage is not visible for internal HMAC.

## AI and Chat Isolation

AI guardrails, output clamping, provider-server-only keys, usage logging, and credit reservation exist. Tenant isolation is not proven across all AI routes, RAG tools, semantic cache, and agent/tool-call paths.

## Client Secret Exposure

Safe static searches found public env names and docs/examples. No live secret values were intentionally accessed or printed. A dedicated secret scanner is still recommended.

## Sensitive List Bounds

Unbounded or insufficiently capped sensitive lists remain in leads, keys, webhooks, admin usage, audit, and log surfaces.

## Dependency and Static Scan Findings

Command: `npm audit --omit=dev --json`

Exit code: `1`

Summary: 0 critical, 0 high, 6 moderate, 1 low. Notable direct runtime findings include moderate OpenTelemetry packages and `next-auth` via transitive `uuid`; no `npm audit fix` was run.

Command: `npm run readiness:audit:no-seed`

Exit code: `1`

Summary: safe no-seed audit performed no DB access, SQL, seed, secret, or migration execution. It failed because current docs no longer contain the older exact `NEEDS_REPLAN` / `NOT_READY` strings expected by that script.

## Dynamic Abuse-Test Status

| Abuse test | Status | Notes |
| --- | --- | --- |
| Team A requests Team B resource | BLOCKED_EXTERNAL_ACCESS | Requires two safe test tenants |
| Member attempts owner/admin action | BLOCKED_EXTERNAL_ACCESS | Requires safe non-admin test user |
| Mass assignment of `teamId/role/ownerId` | NOT_RUN | Static blockers found first |
| Unauthenticated protected route | PARTIAL | Functional smoke carried forward; route-by-route proof incomplete |
| Tampered/replayed internal signature | NOT_RUN | Needs local/staging test |
| Unbounded limit parameter | NOT_RUN | Static blockers found first |
| AI prompt requesting another tenant data | NOT_RUN | Provider execution prohibited |
| API-key list exposure | NOT_RUN | Static blockers found first |
| Mailbox token exposure | NOT_RUN | Provider execution prohibited |
| Webhook without valid signature | NOT_RUN | Static proof partial; needs local/staging test |
| High-cost endpoint without rate limit | NOT_RUN | Static blockers found first |

## Redis Classification

`UNKNOWN_NEEDS_ENV_CONFIRMATION`.

Code paths degrade without Redis and use in-memory caches/rate-limit stores, but production Redis presence, namespace isolation, and multi-instance fail-closed behavior were not verified.

## Provider Gate Decisions

| Provider | Security prerequisites | Current blockers | Allowed next action | Disallowed action | Verdict |
| --- | --- | --- | --- | --- | --- |
| Gmail / Google Workspace | mailbox routes authenticated/team-scoped, ownership enforced, OAuth state/callback constrained, encrypted tokens, no token responses/logs, send rate limit | Pub/Sub token path needs route-limit/replay proof; mailbox ownership and token redaction need dynamic tests; API-key and mass-assignment blockers unresolved | Config/source audit only | Real OAuth, token exchange, Gmail send, mailbox sync with real account | BLOCKED_BY_HIGH |
| LinkedIn | extension bridge authenticated, user-initiated capture only, task endpoints scoped, rate limits, permissions minimized | LinkedIn runner/task endpoint proof incomplete; automation/provider routes remain gated | Config/source audit only | Real LinkedIn actions, scraping, messages, connections, automation | BLOCKED_BY_HIGH |
| NetjanaAI | webhook signature/auth, replay protection, strict validation, team mapping, SSRF/payload bounds, redaction | HMAC optional if secret missing; replay/payload/rate-limit proof incomplete | Contract/config audit only | Production webhook/API call | BLOCKED_BY_HIGH |
| LLM | server-only keys, team-scoped context, rate/credit controls, usage logging, cross-tenant retrieval prevention, prompt/tool restrictions | AI route rate-limit proof incomplete; semantic cache not visibly team-scoped; prompt/tool abuse tests not run | Config/source audit only | Real provider prompts or production provider-key use | BLOCKED_BY_HIGH |

## Required Fixes Before Controlled Beta

| Finding ID | Severity | Affected routes | Exploit scenario | Recommended fix | Tests required | Suggested PR boundary | Provider blocked | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S12A-HIGH-001 | HIGH | API keys | DB/API-key exposure gives live API access | Hash keys, allowlist scopes, cap/list metadata, rotate old keys | Key auth/list/create tests | `fix(security): harden api key storage and scopes` | All | Security/Codex Builder | OPEN |
| S12A-HIGH-002 | HIGH | Dashboard campaign/activity routes | Authenticated user mutates another tenant by ID | Remove legacy routes or add team-scoped ownership and schemas | IDOR tests | `fix(security): scope legacy dashboard routes` | Campaign/provider | Security/Codex Builder | OPEN |
| S12A-HIGH-003 | HIGH | Mutations with broad bodies | Client writes ownership/admin/billing/provider fields | Strict schemas and positive allowlists | Mass-assignment tests | `fix(security): add mutation allowlists` | All | Security/Codex Builder | OPEN |
| S12A-HIGH-004 | HIGH | Lists/logs/keys/leads | Unbounded PII/key/log enumeration | Pagination caps and validation | Limit/bounds tests | `fix(security): bound sensitive list endpoints` | All | Security/Codex Builder | OPEN |
| S12A-HIGH-005 | HIGH | Webhooks/provider callbacks | Forged/replayed provider payload mutates data | Required signatures, nonce/replay, payload cap, route limit | Webhook abuse tests | `fix(security): harden provider webhooks` | Gmail/Netjana | Security | OPEN |
| S12A-HIGH-006 | HIGH | AI/LLM/cache | Cross-tenant cached output or cost abuse | Team-scoped AI cache, route rate limits, prompt/tool tests | AI tenant and rate tests | `fix(security): isolate ai cache and tool routes` | LLM | Security/AI | OPEN |

## Required Fixes Before Gmail Testing

- Complete API-key hardening if Gmail actions can be API-key reachable.
- Prove connected mailbox routes are authenticated, team-scoped, and ownership-checked.
- Prove OAuth callback state and redirect constraints.
- Prove tokens are encrypted and excluded from responses/logs.
- Add Gmail send and Pub/Sub callback rate/replay tests.

## Required Fixes Before LinkedIn Testing

- Prove extension bridge auth and tenant mapping.
- Prove LinkedIn task endpoints are team-scoped and user initiated.
- Add rate limits for capture/draft/task endpoints.
- Keep extension permissions minimized and V2 automation inactive.

## Required Fixes Before NetjanaAI Testing

- Require webhook HMAC/signature in production.
- Add replay protection with nonce/timestamp storage.
- Add strict payload size and schema limits.
- Prove team mapping and error redaction.

## Required Fixes Before LLM Testing

- Team-scope semantic cache and retrieval.
- Prove all AI tools derive team from trusted context.
- Add prompt-injection and cross-tenant retrieval tests.
- Add route-level rate limits and credit assertions.
- Confirm provider keys never reach browser bundles or logs.

## Residual Risk

The main residual risk is that functional smoke passed but security proof is still mostly static. Without two dedicated safe tenants, a non-admin member account, and local/staging abuse tests, the audit cannot prove tenant isolation, role enforcement, mass-assignment resistance, provider callback safety, or AI retrieval boundaries.

## Final Recommendation

Do not begin controlled beta with real customer/team data or real Gmail, LinkedIn, NetjanaAI, or LLM provider usage. Split remediation into small PRs starting with API-key hardening, legacy dashboard route scoping, mutation allowlists, sensitive list caps, provider webhook hardening, and AI cache isolation. Re-run Stage 12A after those fixes and dynamic abuse tests are available.
