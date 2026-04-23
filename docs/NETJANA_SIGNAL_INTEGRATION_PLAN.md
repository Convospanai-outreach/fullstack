# Netjana Signal Integration Plan

## Goal

Use Netjana / ConvoSpan Intel buyer-intent signals to:

1. ingest external intelligence safely through a dedicated webhook/API path,
2. map signals to leads, companies, campaigns, and knowledge,
3. optimize email and LinkedIn outreach using those signals,
4. show a clear dashboard of signal volume, connection status, strength, companies, industries, and buying intent,
5. feed a lightweight wiki + RAG layer so the system learns from shared knowledge and past outcomes.

## Current Implementation Status

As of the current repo state, the core signal path is implemented:

- Dedicated webhook: `apps/api/routes/webhooks/netjana-intel/route.ts`
- Normalization/scoring/matching service: `apps/api/src/modules/intel/service/netjanaIntelService.ts`
- Dashboard API: `apps/api/routes/intel/summary/route.ts`
- Dashboard UI: `apps/web/src/app/(dashboard)/intel/page.tsx`
- Hot-signal follow-up worker: `apps/api/workers/handlers/intel-followup-worker.ts`
- Queue type: `INTEL_FOLLOWUP_REFRESH`
- Signal-aware email path: `composeNodeA` plus `lead.enrichedData.netjana`
- Knowledge path: `Netjana Intelligence` knowledge base items for trusted signals

Still open or configurable:

- A dedicated typed `ExternalSignal` table can replace or extend the current `ShadowSignal` storage.
- Direct Netjana-to-Landing-Agent generation is not enabled by default; `BuyerIntelAdapter` is currently a configurable stub.
- Full upstream detail pull depends on `NETJANA_URL` and feature flags.
- LinkedIn execution remains gated by runner/runtime configuration.

## Source Inputs

Grounded on:

- `c:\Users\tewar\Desktop\convospan_integration_spec.md`
- `c:\Users\tewar\Desktop\covospan_signal_schema.json`
- `c:\Users\tewar\Desktop\signal_graph.md`

Key contract from the Intel system:

- Recommended webhook: `POST /api/webhooks/netjana-intel`
- Auth headers:
  - `x-api-key`
  - `x-source: netjana-intel`
  - `x-netjana-signature` for HMAC
- Main payload:
  - `event`
  - `source`
  - `timestamp`
  - `lead`
  - optional `campaign_id`
  - optional `meta`

Important lead fields:

- `lead_id`
- `company_name`
- `sector`
- `geo_state`
- `buying_stage`
- `intent_score`
- `card_why_now`
- `card_what_they_need`
- `card_do_this`
- `verity_tier`
- `is_triangulated`

## Repo Reality Today

Existing pieces we should reuse:

- Existing inbound ingest patterns:
  - `apps/api/routes/webhooks/scraper-ingest/route.ts`
  - `apps/api/routes/webhooks/ingress/route.ts`
- Existing Netjana polling integration:
  - `apps/api/src/modules/integration/mcp/netjana-server.ts`
  - `apps/api/routes/v1/intelligence/sync/route.ts`
- Existing signal-like storage:
  - `ShadowSignal` in `apps/web/prisma/schema.prisma`
- Existing lead/campaign personalization hooks:
  - `apps/api/workers/handlers/sequenceHandlers.ts`
  - `apps/api/src/modules/email-campaigner/service/emailComposer.ts`
- Existing knowledge/RAG hooks:
  - `apps/api/src/modules/knowledge/services/knowledgeOrchestrator.ts`
  - `apps/api/routes/knowledge/route.ts`
  - `apps/api/routes/rag/search/route.ts`
- Existing signal-oriented dashboard surface that can be upgraded:
  - `apps/web/src/components/dashboard/SovereignConsole.tsx`
  - `apps/api/routes/admin/sovereign-stats/route.ts`

Current gap:

- Netjana signals are active through `ShadowSignal`, `ScrapingJob`, lead enrichment, dashboard aggregation, knowledge items, and hot-signal jobs.
- The remaining model gap is whether to promote signals into a dedicated `ExternalSignal` table for stronger typed querying.
- Direct Landing Agent buyer-intel injection is not configured by default.
- Some upstream detail retrieval and LinkedIn execution paths remain gated by environment configuration and feature flags.

## Target Architecture

### 1. Dedicated Netjana Webhook

Use the dedicated inbound route:

- `apps/api/routes/webhooks/netjana-intel/route.ts`

Responsibilities:

- Verify `x-api-key`
- Verify `x-source === netjana-intel`
- Verify optional `x-netjana-signature` with HMAC if configured
- Validate payload against the documented schema
- Apply idempotency using `lead.lead_id` + `event` + `timestamp`
- Store raw payload for audit/replay
- Trigger downstream normalization and campaign optimization

This route does not overload `scraper-ingest`; the contracts are different enough to keep them separate.

### 2. Canonical Signal Storage

Extend the data model so Netjana signals become queryable business objects.

Recommended data additions:

- `ExternalSignal` or extend `ShadowSignal` to include:
  - `externalId` = Netjana `lead_id`
  - `provider` = `netjana-intel`
  - `eventType`
  - `companyName`
  - `industry`
  - `geoState`
  - `buyingStage`
  - `intentScore`
  - `signalStrength`
  - `verityTier`
  - `isTriangulated`
  - `whyNow`
  - `whatTheyNeed`
  - `recommendedAction`
  - `campaignId`
  - `receivedAt`
  - `meta`
  - `rawPayload`
- Optional `CompanyProfile` table if company-level aggregation becomes important.

If speed matters, start by extending `ShadowSignal` because it already exists and is already used in dashboard-like code.

### 3. Lead / Campaign Mapping

On ingest:

1. Resolve target team from API key.
2. Match existing lead by:
   - campaign lead mapping if `campaign_id` is present,
   - company name,
   - future domain/contact enrichment if available.
3. If no direct lead match exists:
   - create a company-level signal record first,
   - optionally create a placeholder lead or “opportunity seed”.
4. Upsert/update lead fields:
   - `intentScore`
   - `marketContext`
   - `enrichedData`
   - `pipelineState` if strong enough

Suggested normalized lead enrichment payload:

- `netjana.whyNow`
- `netjana.whatTheyNeed`
- `netjana.recommendedAction`
- `netjana.buyingStage`
- `netjana.intentScore`
- `netjana.verityTier`
- `netjana.isTriangulated`
- `netjana.sector`
- `netjana.geoState`

### 4. Signal Strength Model

Follow the graph doc and compute:

- `signal_strength = confidence_score x freshness_factor`

For Netjana v1, use:

- `confidence_score` from:
  - normalized `intent_score / 100`
  - boost if `verity_tier === TIER_1`
  - boost if `is_triangulated === true`
- `freshness_factor = exp(-days_since_signal / 30)`

Store:

- raw `intentScore`
- derived `signalStrength`
- `temperatureBand`: `HOT`, `WARM`, `COLD`

Suggested trigger rules:

- `signalStrength >= 0.75` -> hot campaign action
- `signalStrength >= 0.5` -> refresh drafts / move to review
- below that -> dashboard-only / knowledge-only

### 5. Campaign Optimization Logic

Netjana signals should affect campaigns in three ways.

#### A. Draft Optimization

When a signal arrives, regenerate or improve drafts using:

- `card_why_now` as the opening hook
- `card_what_they_need` as pain context
- `card_do_this` as CTA/action guidance
- `buying_stage` to adjust urgency and tone

Touch points:

- `apps/api/src/modules/email-campaigner/service/emailComposer.ts`
- `apps/api/workers/handlers/sequenceHandlers.ts`
- LinkedIn message generation via `aiService.generateConnectionMessage`

#### B. Campaign Routing

If `campaign_id` is present:

- attach signal to that campaign,
- update campaign analytics,
- prioritize matching leads in execution queues.

If not present:

- route by sector + company + current active campaigns,
- or place into an “Intel Review” queue for operators.

#### C. Trigger Automation

Examples:

- new high-intent signal for an existing account -> enqueue draft refresh
- decision-stage signal -> enqueue approval request for immediate outreach
- repeated signal on same company -> escalate to multi-touch sequence

## Frontend Dashboard Plan

### New Intel Dashboard

Add a dedicated dashboard page, for example:

- `apps/web/src/app/(dashboard)/intel/page.tsx`

Or reuse and evolve:

- `apps/web/src/components/dashboard/SovereignConsole.tsx`

Recommended widgets:

1. Connection status
   - connected / degraded / disconnected
   - last webhook received time
   - signature verification state
2. Signals received
   - total signals
   - signals today / 7d / 30d
3. Signal strength
   - average strength
   - hot / warm / cold counts
4. Buying intent overview
   - awareness / consideration / decision counts
5. Industry breakdown
   - sectors with signal counts
6. Company breakdown
   - companies with strongest or newest signals
7. “ALM companies” / key accounts panel
   - top named companies by signal count and strength
8. Recent signal feed
   - why now
   - what they need
   - recommended action
   - campaign mapping status
9. Outreach impact
   - drafts regenerated
   - campaigns influenced
   - leads promoted

### API for Dashboard

Add:

- `GET /api/intel/summary`
- `GET /api/intel/signals`
- `GET /api/intel/companies`
- `GET /api/intel/industries`
- `GET /api/intel/connection-status`

These should aggregate canonical signal storage, not raw scraping jobs.

## Knowledge / Wiki / RAG Plan

### Lightweight Wiki

Create a team knowledge collection for Intel:

- one knowledge base per team, e.g. `Netjana Intelligence`

For every ingested signal, write one normalized wiki-style knowledge item:

- title: `Company - Why now`
- body:
  - company
  - sector
  - stage
  - signal summary
  - what they need
  - recommended action
  - source + timestamp

This gives the user a readable wiki and also makes the signal retrievable through RAG.

### RAG Usage

When generating outreach:

1. retrieve campaign context,
2. retrieve company/industry signal context,
3. retrieve prior successful patterns from learning/memory,
4. synthesize grounded drafts.

Touch points:

- `apps/api/src/modules/knowledge/services/knowledgeOrchestrator.ts`
- `apps/api/routes/rag/search/route.ts`
- `apps/api/src/modules/learning/learningService.ts`
- `apps/api/src/modules/email-campaigner/service/emailComposer.ts`

### RAG Query Goals

The system should be able to answer:

- Why are we contacting this company now?
- What is the strongest evidence of buyer intent?
- What industry context should shape this draft?
- Which prior campaign patterns worked for similar signals?

## Suggested Implementation Phases

### Phase 1: Ingestion Foundation

- add `POST /api/webhooks/netjana-intel`
- verify auth and HMAC
- validate schema
- add idempotency
- store raw payload + normalized signal
- record connection status and last heartbeat

### Phase 2: Canonical Signal Model

- extend `ShadowSignal` or add `ExternalSignal`
- add indexes for:
  - `teamId`
  - `companyName`
  - `industry`
  - `buyingStage`
  - `intentScore`
  - `signalStrength`
  - `receivedAt`
- add campaign and lead links

### Phase 3: Campaign Optimization Engine

- map signals to leads/campaigns
- update lead `intentScore`
- write `enrichedData.netjana`
- regenerate email and LinkedIn drafts
- queue high-strength signals for approval/execution

### Phase 4: Intel Dashboard

- add summary APIs
- add dashboard UI with:
  - total signals
  - industries
  - companies
  - buying stages
  - signal strength
  - connection status
  - recent feed

### Phase 5: Wiki + RAG

- create Intel knowledge ingestion service
- write normalized signal docs into knowledge base
- include retrieved Intel knowledge in draft generation
- expose simple search over Intel knowledge

### Phase 6: Feedback Loop

- track whether signal-driven drafts lead to:
  - opens
  - replies
  - meetings
  - conversions
- use those outcomes to tune scoring and recommendations

## Concrete First Build Slice

The best first end-to-end slice is:

1. implement `POST /api/webhooks/netjana-intel`,
2. store normalized signals,
3. expose `GET /api/intel/summary`,
4. build a dashboard page,
5. inject top signal context into draft generation.

That gives immediate user-visible value without waiting for the full graph system.

## Recommended Acceptance Criteria

### Backend

- webhook accepts valid Netjana payloads
- invalid API key or signature is rejected
- duplicate `lead_id` pushes do not duplicate records
- normalized signal records are queryable by team/company/industry

### Dashboard

- shows connection state
- shows signal count
- shows industry counts
- shows company counts
- shows buying-stage counts
- shows signal-strength distribution
- shows recent signals feed

### Campaign Optimization

- email drafts reflect `card_why_now`
- CTA reflects `card_do_this`
- lead/campaign receives updated intent metadata
- high-confidence signals can trigger campaign refresh or review

### Knowledge / RAG

- each accepted signal becomes a readable knowledge item
- RAG can retrieve Intel context for the target company/sector
- drafts use grounded Intel context instead of generic outreach

## Recommended Next Coding Tasks

1. Add Prisma model changes for canonical Intel signal storage.
2. Implement `POST /api/webhooks/netjana-intel`.
3. Add `GET /api/intel/summary` and recent-feed APIs.
4. Build dashboard UI for Intel metrics and connection status.
5. Attach normalized Intel context to draft generation and lead enrichment.
6. Ingest accepted signal summaries into the knowledge base for RAG.
