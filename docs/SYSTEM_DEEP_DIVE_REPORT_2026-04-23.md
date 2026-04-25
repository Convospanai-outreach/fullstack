# System Deep Dive Report

Date: 2026-04-23

## Scope

This review focused on:

- `apps/web` request handling, middleware/proxy behavior, and runtime assumptions
- `apps/api` route loading, auth/session propagation, queue/worker behavior, and external integrations
- shared AI/TOON paths, Netjana ingest, landing/public ingress, and deployment drift
- likely outage, integrity, and operational failure points

Method:

- direct repository inspection
- one completed adversarial architecture review pass
- additional backend/web async review workers were started but did not return in time, so this report is grounded in the confirmed code paths below

## Executive Summary

The app is functional, but it has several places where convenience fallbacks have become production behavior. The main risk is not one catastrophic bug; it is a cluster of mismatched contracts:

- legacy task routes that bypass the newer auth and queue model
- different team-selection rules in web vs API vs extension flows
- AI privacy/guardrail fallbacks that are permissive under pressure
- deployment/runtime artifacts that no longer cleanly match the current monorepo shape

The safest path to improve the app without breaking it is to harden the boundaries first, not rewrite the core. Start by removing unauthenticated legacy paths, making degraded modes explicit, tightening signal ingress trust, and adding contract tests around the `web -> proxy -> api -> auth -> team context` chain.

## System Shape Today

At a high level, the live system behaves like this:

1. Browser traffic hits `apps/web`.
2. `apps/web` middleware/proxy applies auth, rate limiting, and forwards many requests to `apps/api`.
3. `apps/api` runs a Fastify server that dynamically loads Next-style route handlers through an adapter.
4. Most durable state sits in Postgres through duplicated Prisma clients in both web and API.
5. Background execution uses a DB-backed `Job` queue plus a separate legacy `AgentTask` path for extension/browser automation.
6. External systems include Netjana buyer signals, email generation/sending, LinkedIn automation, Redis cache/session helpers, and an optional edge runtime.

That shape is viable, but the boundaries between the old and new subsystems are where breakage is most likely.

## Top 5 Likely Failure Or Outage Points

### 1. Legacy queue endpoints are unauthenticated and bypass the newer task model

Why this will break:

- any caller can fetch pending browser work
- any caller can mark tasks complete or failed
- this creates both security risk and state corruption risk
- it also means there are two browser-task systems with different contracts

Evidence:

- `apps/api/routes/queue/pending/route.ts:6` exposes `GET` without auth
- `apps/api/routes/queue/pending/route.ts:11-37` returns executable task payloads directly from `agentTask`
- `apps/api/routes/queue/result/route.ts:6` exposes `POST` without auth
- `apps/api/routes/queue/result/route.ts:31-48` updates task state and writes execution logs directly
- compare with the newer authenticated path in `apps/api/routes/extension/tasks/route.ts:5-57`

Impact:

- fake completions
- lost work
- task theft
- browser automation state getting out of sync with operator expectations

### 2. Team and workspace resolution is inconsistent across web, API, and extension flows

Why this will break:

- the same user can resolve to different teams depending on which path they hit
- web silently falls back to the first team, while API now requires explicit workspace choice for multi-team users
- extension writes still default to the first team ID

Evidence:

- web fallback: `apps/web/src/lib/auth.ts:243-254`
- API strict selection: `apps/api/src/lib/auth.ts:316-320` and the same pattern earlier in `getCurrentContext()`
- extension defaulting to first team: `apps/api/routes/extension/push/route.ts:11`
- extension auth only returns `teamIds`, no explicit selected team contract: `apps/api/routes/extension/_lib/auth.ts:142-143`
- proxy forwards request headers/cookies straight through with minimal filtering: `apps/web/src/app/api/proxy/[...path]/route.ts:31-58`

Impact:

- misrouted writes
- cross-team confusion
- hard-to-reproduce bugs where the UI and API disagree on current workspace

### 3. Queue and worker execution has split-brain contracts

Why this will break:

- the main `JobQueue` uses one set of types and states
- the extension task path expects another
- the worker loop only handles a subset of declared job types

Evidence:

- canonical job types and states: `apps/api/src/lib/queue.ts:22-38` and `apps/api/src/lib/queue.ts:128-178`
- extension task claims use `VIEW_PROFILE`, `LIKE_POST`, `CONNECT` and `processing`: `apps/api/routes/extension/tasks/route.ts:20-45`
- legacy queue routes use `agentTask` instead of `job`: `apps/api/routes/queue/pending/route.ts:11-35`
- worker manager is a single poll loop over the DB queue: `apps/api/workers/worker-manager.ts:20-27`
- stale-job recovery assumes a different state vocabulary again: `apps/api/src/lib/queue.ts:253-260`

Impact:

- orphaned jobs
- double claims
- tasks stuck in the wrong status forever
- operators unable to reason about actual queue health

### 4. Netjana ingest trust and idempotency are too weak for a critical signal path

Why this will break:

- HMAC verification is optional in production if the secret is absent
- signal identity is based only on `teamId + lead_id + optional nonce`
- different buyer-signal events for the same lead can collapse into one identity if nonce is absent

Evidence:

- HMAC is conditional, not required: `apps/api/routes/webhooks/netjana-intel/route.ts:33-47`
- signal ID creation: `apps/api/src/modules/intel/service/netjanaIntelService.ts:275-290`
- verification mode falls back to shared-key-only: `apps/api/src/modules/intel/service/netjanaIntelService.ts:335-337`

Impact:

- replayed or forged signals if ingress credentials leak
- real events being deduplicated incorrectly
- incorrect automation decisions downstream in email/LinkedIn flows

### 5. TOON and the AI boundary are useful, but not currently a hard safety boundary

Why this will break:

- `TOON.process()` depends on `SovereignFirewall.mask()`
- if the edge sanitizer is unavailable and strict sovereignty is off, local masking can return the raw prompt unchanged for `GLOBAL`
- many high-value generation paths bypass output guardrails when `expectsJson` or `disableGuardrails` is set

Evidence:

- TOON delegates to the firewall, then compresses: `apps/api/src/lib/ai/TOON.ts:22-33`
- permissive local fallback: `apps/api/src/lib/ai/SovereignFirewall.ts:105-115`
- guardrails are skipped entirely when `expectsJson` or `disableGuardrails` is true: `apps/api/src/lib/aiService.ts:253-259`
- email composition uses both flags in the main generation loop: `apps/api/src/modules/email-campaigner/service/emailComposer.ts:319-326`

Impact:

- prompt/data leakage risk under fallback
- malformed JSON or prompt drift taking down multi-step compose flows
- false confidence in TOON as a privacy guarantee when it is currently best treated as a pre-processing helper

## Additional Watchlist

These are not the top five, but they are material:

- API auth silently falls back to synthetic low-tier defaults on JWT enrichment failure: `apps/api/src/lib/auth.ts:131-137`
- `apps/web` and `apps/api` duplicate Prisma client wrappers and invariants, increasing drift risk: `apps/api/src/lib/db.ts:11-65`, `apps/web/src/lib/db.ts:8-62`
- the Fastify-to-Next adapter is a fragile contract surface for cookies, body handling, and content types: `apps/api/server.ts:87-158`
- the web proxy has no upstream timeout or header allowlist: `apps/web/src/app/api/proxy/[...path]/route.ts:31-58`
- `docker-compose.yml` appears stale relative to the actual app layout and runtime entrypoints: `docker-compose.yml:38-118`
- agentic RAG is likely using the wrong identifier entirely: `apps/api/src/modules/agent/core/AgentExecutor.ts:256` calls `KnowledgeIngressService.agenticSearch(task.teamId, query)` even though the service expects a campaign ID
- approvals are reused by `entityType + entityId + actionType` only, which can approve stale payloads: `apps/api/src/modules/governance/ApprovalService.ts:25-37`

## What To Change Without Breaking The App

### P0: Boundary hardening first

These are the safest, highest-return changes because they harden boundaries without changing product intent.

1. Disable or auth-gate the legacy `/api/queue/pending` and `/api/queue/result` routes.
2. Stop inferring `teamIds[0]` for extension writes; require an explicit team selection header or workspace token.
3. Make Netjana HMAC mandatory in production, with a short compatibility flag during rollout if needed.
4. Widen Netjana idempotency identity to include `event`, `timestamp`, and stable upstream source identifiers in addition to `lead_id`.
5. Add contract tests for `web middleware/proxy -> api adapter -> auth/session -> team context`.

### P1: Make degraded modes visible instead of silent

1. Replace silent Redis failures with explicit degraded-mode flags and health endpoints.
2. Stop defaulting JWT enrichment to synthetic access values on lookup failure; return a clearly degraded auth state instead.
3. Add upstream timeouts and response/header filtering to the web proxy.
4. Add size limits and tighter schema enforcement for public landing/event ingest payloads.
5. Fix the agentic RAG identifier bug in `AgentExecutor` and cover it with a regression test.

### P2: Converge duplicated contracts

1. Consolidate auth/team-context resolution into one shared package or one source-of-truth helper.
2. Consolidate Prisma schema/client setup instead of mirroring the same wrapper logic in web and API.
3. Choose one queue/task vocabulary and make legacy extension flows a compatibility adapter, not a parallel system.
4. Align `docker-compose.yml`, runbooks, and start scripts with the current monorepo topology.

## How To Leverage TOON Safely

Current reality:

- TOON is already helpful for prompt compression and some prompt hygiene.
- It is not reliable enough today to be treated as a hard privacy or compliance boundary.

Best use cases right now:

1. Pre-LLM prompt compaction for expensive or latency-sensitive calls.
2. Structured/tabular serialization before RAG or summarization.
3. Explicit redaction in workflows where the downstream model does not need exact identifiers.
4. Cost and token observability on high-volume generation paths.

Safe next step:

- introduce explicit modes such as `redact-only`, `compress-only`, and `redact+compress`
- centralize on `packages/toon-core` instead of maintaining near-duplicate implementations in `apps/api` and `apps/web`
- add instrumentation to every `TOON.process()` call: input size, output size, latency, estimated cost, redaction mode
- apply it first to the highest-risk paths that already bypass normal guardrails

Do not use TOON as the authority for:

- signed webhook bodies
- approval payloads that must preserve exact fidelity
- records that later need exact byte-for-byte auditability
- any compliance promise unless `STRICT_SOVEREIGNTY` is enforced and tested

## How To Leverage Go

Current reality:

- there is no existing Go code in this repo
- `rg --files -g "*.go"` returned no results
- adding Go now would be a greenfield operational choice, not an incremental language extension

Where Go can help later:

1. A narrow Netjana ingest gateway that does only HMAC verification, replay protection, deduplication, and enqueueing.
2. A public landing-event ingest edge service that needs strict body limits, simple validation, and high request concurrency.
3. A queue/worker sidecar if DB polling becomes a measurable hotspot and the execution contract has already stabilized.

Where Go should not go first:

1. Auth/session handling
2. Team/workspace resolution
3. Approval logic
4. Core campaign/lead domain workflows
5. Anything that currently depends tightly on Prisma models and NextAuth assumptions

Recommendation:

- do not introduce Go into the core domain yet
- if you want to use it, pilot one stateless ingress service with a very small API surface and hard contract tests
- only do that after the current TypeScript contracts are stabilized, otherwise you will multiply drift instead of reducing it

## Adversarial Critique Summary

The completed adversarial review agreed with the core conclusions above and added these attack and integrity themes:

- the unauthenticated legacy queue endpoints are the fastest path to unauthorized task manipulation
- proxy forwarding plus cookie-selected workspace handling creates confused-deputy risk
- Netjana shared-key-only mode is too weak for a trust-bearing automation signal
- extension flows still permit “first team wins” behavior
- TOON/Sovereign fallback and JSON/guardrail bypasses can leak or distort model inputs/outputs
- approval reuse can cause stale intent or stale content to be approved accidentally

## Recommended Delivery Sequence

If the goal is to improve the app without breaking it, this is the order I would use:

### Phase 1: 1 to 3 days

- auth-gate or remove legacy queue routes
- require explicit team selection for extension writes
- add production health signals for Redis, edge sanitizer, and provider availability
- add proxy timeout and basic header allowlist/denylist

### Phase 2: 3 to 7 days

- make Netjana HMAC mandatory in production
- widen signal idempotency keys
- add contract tests across web proxy, API adapter, auth, and extension task claim/report flows
- fix the agentic RAG identifier bug

### Phase 3: 1 to 2 sprints

- converge queue/task state vocabulary
- consolidate auth/team resolution
- consolidate Prisma schema/client ownership
- centralize TOON into one shared implementation with explicit modes and metrics
- clean up deployment artifacts and runbooks so local, CI, and production topologies match

## Bottom Line

The app does not need a rewrite. It needs boundary discipline.

The highest-value non-breaking improvements are:

1. remove or gate the legacy unauthenticated paths
2. make team selection explicit everywhere
3. harden signal ingest and degraded-mode behavior
4. add contract tests at service boundaries
5. treat TOON as a utility layer, not a trust boundary

If those are done first, the rest of the architecture becomes much safer to optimize, scale, and eventually split into narrower services.
