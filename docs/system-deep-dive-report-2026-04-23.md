# System Deep Dive Report

Date: 2026-04-23
Repo: `d:/Convo/fullstack`
Scope: `apps/web`, `apps/api`, queueing, auth/session flow, Netjana ingest, landing-agent public surfaces, AI routing, TOON, and deployment/ops drift.

## Executive Summary

The app's biggest risks are not in the main product ideas. They are in the boundary layers where older and newer paths coexist:

- two queue/task systems (`agentTask` extension flow vs `Job` queue flow)
- different team-selection behavior between web, API, and extension surfaces
- duplicated Prisma and TOON code paths across apps
- "optional" fallback behavior for Redis, edge runtime, and privacy masking that can quietly change system behavior under stress

The good news is that the safest improvements are also the highest-return ones. This repo does not need a large rewrite first. The non-breaking path is:

1. fence off legacy unauthenticated routes
2. unify tenant/workspace selection rules
3. expose degraded-mode health instead of silently failing open
4. harden Netjana signature + idempotency
5. fix the known RAG scoping bug
6. consolidate queue and TOON contracts only after the seams are stable

## What To Change Safely

### P0: Immediate, low-risk hardening

#### 1. Disable or auth-gate the legacy extension queue endpoints

Why this matters:

- `apps/api/routes/queue/pending/route.ts:6` exposes pending browser work without auth.
- `apps/api/routes/queue/result/route.ts:6` lets any caller mark task results by `commandId`.

Why it is likely to break or be abused:

- anyone who can reach these routes can poll browser commands or write task results
- the routes use `agentTask`, while the newer authenticated extension path uses `Job`

Safest change:

- if unused, disable them outright behind an env flag
- if still needed, require `validateExtensionAuth()` and team scoping exactly like `apps/api/routes/extension/tasks/route.ts:7`

#### 2. Make team selection explicit and consistent across web, API, and extension writes

Why this matters:

- API auth correctly forces workspace choice for multi-team users at `apps/api/src/lib/auth.ts:316`
- web auth still falls back to the first team at `apps/web/src/lib/auth.ts:243`
- extension profile ingest writes to `auth.teamIds[0]` at `apps/api/routes/extension/push/route.ts:11`

Why it is likely to break:

- silent writes to the wrong team are integrity bugs, not just UX bugs
- multi-team sessions can read/write different workspaces depending on which surface handled the request

Safest change:

- preserve single-team auto-selection only when the user has exactly one membership
- otherwise require an explicit workspace/team selection signal everywhere
- never infer `teamIds[0]` for writes

#### 3. Make Netjana webhook verification mandatory in production and widen dedupe identity

Why this matters:

- webhook verification is optional if no secret is configured at `apps/api/routes/webhooks/netjana-intel/route.ts:33`
- signal identity is derived from `teamId + lead_id + nonce` at `apps/api/src/modules/intel/service/netjanaIntelService.ts:275`

Why it is likely to break:

- production can silently run in shared-key-only mode
- distinct signals for the same lead can collapse if nonce handling is inconsistent

Safest change:

- in production, refuse startup or reject requests unless `NETJANA_HMAC_SECRET` is configured
- add replay-window enforcement using timestamp + nonce
- widen the signal identity to include stable event characteristics such as event type, source id, and external timestamp

#### 4. Fix the agentic RAG scoping bug

Why this matters:

- `KnowledgeIngressService.agenticSearch()` expects a campaign id at `apps/api/src/modules/rag/service/KnowledgeIngressService.ts:64`
- `AgentExecutor` passes `task.teamId` at `apps/api/src/modules/agent/core/AgentExecutor.ts:256`

Why it is likely to break:

- autonomous agent runs can search the wrong knowledge context or return empty context
- this creates low-confidence output that looks valid but is poorly grounded

Safest change:

- fix the argument wiring and add one regression test
- this is a tiny code change with outsized quality benefit

#### 5. Stop hiding degraded dependency states

Why this matters:

- API Redis logs a critical warning and then degrades silently at `apps/api/src/lib/redis.ts:13`
- `safeGet`/`safeSet`/`safeDel` swallow failures at `apps/api/src/lib/redis.ts:81`
- edge runtime is optional by default at `apps/api/src/lib/edgeRuntime.ts:31`
- the web proxy has no timeout or header allowlist at `apps/web/src/app/api/proxy/[...path]/route.ts:31`

Why it is likely to break:

- incidents show up as "weird behavior" instead of clean unhealthy signals
- one slow upstream can pin request paths indefinitely

Safest change:

- add a dependency-health endpoint that reports Redis, DB, edge runtime, and LLM provider status
- add request timeouts and an upstream header allowlist to the web proxy
- surface "degraded mode" in logs and admin diagnostics instead of relying on console warnings

### P1: Structural cleanup after the seams are fenced

#### 6. Collapse onto one queue/task contract

Evidence:

- canonical DB-backed queue is `JobQueue` in `apps/api/src/lib/queue.ts:52`
- extension poller uses `Job` records in `apps/api/routes/extension/tasks/route.ts:20`
- legacy browser execution path still uses `agentTask` in `apps/api/routes/queue/pending/route.ts:11`

Risk:

- task starvation, operator confusion, and broken retries because there are two execution vocabularies and two persistence models

Safe path:

- define one canonical state machine and add a compatibility adapter during migration
- remove direct client use of the legacy `agentTask` queue path

#### 7. Consolidate Prisma schema/client ownership

Evidence:

- both apps keep near-identical Prisma clients with the same `message.create` invariant:
  - `apps/api/src/lib/db.ts:26`
  - `apps/web/src/lib/db.ts:23`

Risk:

- schema drift and behavioral drift will show up late and expensively

Safe path:

- move Prisma client creation and invariants into one shared package
- keep app-local wrappers thin

#### 8. Consolidate TOON implementation around one shared core

Evidence:

- shared core exists at `packages/toon-core/index.ts:1`
- app-local TOON wrappers still depend on duplicated `toonCore` implementations:
  - `apps/api/src/lib/ai/TOON.ts:2`
  - `apps/web/src/lib/ai/TOON.ts:2`

Risk:

- the optimization logic will drift and be hard to validate

Safe path:

- make `packages/toon-core` the single source of truth
- keep only thin app-specific adapters around privacy policy and telemetry

### P2: Reliability polish and ops cleanup

#### 9. Tighten public landing-agent intake limits

Reason:

- public landing endpoints already rely heavily on proxy/rate-limit behavior
- the repo should add explicit payload-size guards, event schema limits, and abuse counters at the handler layer

#### 10. Refresh local/ops deployment assets

Evidence:

- `docker-compose.yml` still references drifted services and runtime assumptions:
  - `./services/edge-node` at `docker-compose.yml:66`
  - `convospan-worker:patched` and `node worker.js` at `docker-compose.yml:94`
  - Docker socket mounted into web at `docker-compose.yml:51`

Risk:

- new environments will be brought up with the wrong mental model

Safe path:

- align compose with current `apps/web`, `apps/api`, and optional `apps/edge-fastapi`
- clearly mark any historical services as archival or remove them

## Where The App Is Most Likely To Break

| Area | Likely failure mode | Why it breaks | Blast radius |
| --- | --- | --- | --- |
| Legacy extension queue | Unauthorized polling or result writes | `queue/pending` and `queue/result` have no auth | High |
| Team/workspace selection | Read/write against wrong team | web, API, and extension use different fallback rules | High |
| Web proxy to API | Hanging or leaky upstream calls | no timeout, broad header forwarding, raw response passthrough | High |
| Fastify adapter session path | auth/session mismatch | Next-style route handlers are reconstructed through a custom `Request` bridge in `apps/api/server.ts:87` | High |
| Queue execution model | orphaned or stranded work | `agentTask` flow and `Job` flow coexist | High |
| Redis degradation | hidden cache/rate-limit/session drift | failure is logged but mostly swallowed | Medium |
| AI draft generation | brittle parse and provider outage | JSON parse expectations plus no provider fallback in `apps/api/src/lib/aiService.ts:83` and `apps/api/src/modules/email-campaigner/service/emailComposer.ts:320` | Medium |
| Privacy/sovereignty boundary | unexpected cloud egress or unmasked fallback | `SovereignFirewall.maskLocal()` returns raw text in common global non-strict mode at `apps/api/src/lib/ai/SovereignFirewall.ts:112` | High for compliance-sensitive workloads |
| Netjana signal ingest | forged, replayed, or collapsed signals | optional HMAC plus narrow dedupe identity | Medium to High |
| Infra bootstrap | local/prod confusion | compose and runtime docs have drifted | Medium |

## Deep Dive By Subsystem

### Auth and tenant routing

The repo already contains the correct instinct: the API side forces explicit workspace choice for multi-team users. The problem is that this rule is not universal.

- API side:
  - JWT enrichment falls back to synthetic defaults on failure at `apps/api/src/lib/auth.ts:131`
  - request-bound context throws `WORKSPACE_SELECTION_REQUIRED` for multi-team users at `apps/api/src/lib/auth.ts:316`
- web side:
  - first-team fallback remains at `apps/web/src/lib/auth.ts:243`
- extension side:
  - write path picks the first team id at `apps/api/routes/extension/push/route.ts:11`

That means tenant isolation is policy-by-surface, not policy-by-platform. This is one of the main places the app can "work" while still doing the wrong thing.

### Queueing and worker reliability

The DB-backed `JobQueue` has some healthy pieces already:

- idempotency support at `apps/api/src/lib/queue.ts:79`
- claim-then-update behavior at `apps/api/src/lib/queue.ts:147`
- exponential backoff and dead-letter handling at `apps/api/src/lib/queue.ts:203`
- stale job reset at `apps/api/src/lib/queue.ts:253`

The real reliability problem is split ownership:

- `Job` is the canonical worker queue
- extension polling also reads `Job`
- legacy browser routes still mutate `agentTask`

This is where operator confidence usually dies. A task can appear stuck, missing, or "completed" depending on which table you inspect.

### Web-to-API boundary

The web proxy is currently convenient, but it is doing very little mediation:

- copies most request headers at `apps/web/src/app/api/proxy/[...path]/route.ts:31`
- forwards raw upstream response headers/body at `apps/web/src/app/api/proxy/[...path]/route.ts:53`
- uses no timeout or abort controller

The API server then reconstructs Next-style requests through a custom Fastify bridge at `apps/api/server.ts:87`. That bridge is reasonable, but it is also a trust boundary. Cookie propagation, header casing, content types, and `set-cookie` handling all rely on adapter behavior rather than a stock runtime.

This seam deserves contract tests more than it deserves new features.

### Netjana buyer signal flow

There is real discipline in the Netjana pipeline:

- trust scoring is conservative
- `safeForAutomation` is derived before follow-up queueing
- follow-up enqueue uses idempotency in `apps/api/src/modules/intel/service/netjanaIntelService.ts:431`

The weak spots are around ingress integrity, not downstream reasoning:

- HMAC is optional if the secret is absent
- signal identity is too narrow for long-lived dedupe

So the right move is not to redesign the intel pipeline. It is to make ingress stricter and more replay-resistant.

### AI routing, TOON, and sovereignty

TOON is useful here, but it needs to be treated as a prompt-shaping layer, not a hard privacy boundary.

Current facts:

- TOON is already used in RAG and agent execution:
  - `apps/api/src/modules/rag/service/KnowledgeIngressService.ts:25`
  - `apps/api/src/modules/agent/core/AgentExecutor.ts:203`
- `TOON.process()` calls `SovereignFirewall.mask()` at `apps/api/src/lib/ai/TOON.ts:24`
- in common non-strict global mode, local fallback can return raw content unchanged at `apps/api/src/lib/ai/SovereignFirewall.ts:112`
- `AIService.askAI()` skips output guardrails whenever `expectsJson` or `disableGuardrails` is set at `apps/api/src/lib/aiService.ts:257`
- email drafting uses both `expectsJson` and `disableGuardrails` at `apps/api/src/modules/email-campaigner/service/emailComposer.ts:320`

Conclusion:

- TOON is good for compression, prompt hygiene, and token-cost control
- TOON is not yet a trustworthy compliance boundary

### Ops and deployment drift

The repo's intended runtime is clear from scripts and app layout, but the deployment artifacts are telling older stories.

- root quick path is based on `apps/web` + `apps/api`
- compose still refers to older worker and edge assumptions
- production start for API still uses `tsx server.ts` semantics from `apps/api/package.json`

This kind of drift creates outages during environment rebuilds, not during normal local coding.

## How To Leverage TOON Safely

### Best uses right now

1. Prompt compaction before cloud LLM calls for:
   - RAG query reformulation
   - large context email drafting
   - campaign summaries
   - signal summarization

2. Structured serialization for bulky records:
   - use `serializeTabularData()` from `packages/toon-core/index.ts:17` for lead lists, signals, and comparison sets

3. Cost and size telemetry:
   - log raw size, optimized size, estimated cost, and task type for every TOON invocation

### Changes to make before expanding TOON use

1. Define explicit operating modes:
   - `compress_only`
   - `redact_only`
   - `redact_and_compress`

2. Centralize the implementation:
   - keep optimization in `packages/toon-core`
   - keep masking policy in one place

3. Add golden tests:
   - representative prompts
   - expected compaction
   - expected token-map behavior
   - strict vs non-strict sovereignty behavior

### Where not to use TOON

Do not use TOON as a silent wrapper around:

- approval payloads that need exact fidelity
- signed webhook payloads
- exact audit records
- anything that must be provably redacted before cloud egress unless `STRICT_SOVEREIGNTY=true`

## How To Leverage Go

Current state:

- there are no `.go` files in the repo today

That means Go should only be introduced where it gives operational leverage without forcing the core app model to split in half.

### Good first candidates

#### 1. Netjana ingest gateway

Why Go can help:

- cheap concurrent request handling
- straightforward HMAC + replay-window enforcement
- clean fit for a narrow JSON contract

Scope:

- receive webhook
- verify signature
- enforce timestamp skew / nonce replay protection
- write to API or queue only after validation

#### 2. Public landing event collector

Why Go can help:

- high-volume, simple validation, low-latency path
- ideal for abuse controls, buffering, and coarse enrichment

Scope:

- accept public landing events
- size-limit, rate-limit, normalize, and forward

#### 3. Worker sidecar later, not first

Why:

- if DB polling becomes a hotspot, Go is a decent place for a small dispatcher/consumer sidecar
- but only after the queue contract is singular and stable

### Bad candidates for Go right now

Do not move these first:

- auth/session resolution
- team/workspace selection
- approval workflow
- Prisma-heavy domain logic
- web proxy and Next.js surface

Those are the areas where contract drift would hurt the most.

### Safe adoption sequence for Go

1. Stabilize the contracts in TypeScript first
2. Define a schema-first boundary (OpenAPI or explicit JSON schema)
3. Run Go service in shadow mode with mirrored traffic
4. Compare outputs and error rates
5. Cut over one narrow edge endpoint at a time

## Adversarial Critique Highlights

An adversarial architecture pass on the repo produced the same core theme: the app is most exposed where legacy and current systems overlap.

Most important critique points:

1. legacy queue endpoints are effectively open write/read surfaces
2. workspace/team confusion creates confused-deputy behavior
3. Netjana ingress needs stricter signature and replay discipline
4. TOON/Sovereign fallback should not be treated as a hard privacy guarantee
5. approval reuse and queue/task contract drift can create subtle integrity failures

I agree with that critique. The repo does not mainly need "smarter AI." It needs stricter boundaries.

## Safe Remediation Sequence

1. Fence legacy queue routes behind auth or turn them off
2. Unify workspace selection semantics across web, API, and extension flows
3. Fix the `AgentExecutor` RAG campaign/team mismatch
4. Add dependency-health reporting and proxy timeouts
5. Make Netjana HMAC mandatory in production and add replay protection
6. Add end-to-end contract tests for `web proxy -> api adapter -> auth -> team context`
7. Collapse to one queue/task vocabulary
8. Consolidate Prisma and TOON ownership into shared packages
9. Only then introduce Go for narrow ingress/edge services

## Recommended Tests Before Any Big Refactor

1. Unauthorized access tests for:
   - `/api/queue/pending`
   - `/api/queue/result`
   - extension task/result flows

2. Multi-team routing tests for:
   - web requests with and without workspace cookie
   - API route handlers through Fastify adapter
   - extension writes with explicit team selection

3. Netjana ingest tests for:
   - missing signature in production
   - replayed nonce
   - duplicate event handling
   - valid hot signal enqueue path

4. AI-path reliability tests for:
   - provider outage
   - invalid JSON from model
   - strict sovereignty enabled vs disabled
   - TOON mode behavior

5. Queue/worker tests for:
   - claim semantics under concurrency
   - stale job reset
   - dead-letter notification flow

## Final Judgment

This app can be improved materially without breaking it, but the right moves are boring in the best possible way:

- remove old unauthenticated paths
- make tenant selection explicit
- fail loudly when critical dependencies degrade
- tighten signal ingress
- reduce duplication before adding new runtimes

Use TOON more as a disciplined prompt-processing layer. Use Go only for narrow edge services after contracts are stabilized. Do not start with a platform rewrite. The biggest reliability gains are sitting in a handful of boundary fixes that are small enough to land safely.
