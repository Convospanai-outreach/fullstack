# Lead-Gen & Scoring: Marketing Promise vs. Implementation Reality

Research trace, 2026-08-24. Scope: does the "signal → score → outreach" story told on the marketing
homepage and in the architecture docs match what the code actually does. All findings below are
sourced from direct code reads (file:line cited); nothing here is inferred from docs alone.

## 1. The promise (marketing + architecture docs)

`apps/web/src/components/marketing/CinematicHome.tsx` tells a 9-act story (`ACTS` array): intake →
"the leak" (leads going cold) → paradigm shift → **Layer 01 Netjana** ("signal" — buyer intent
detection) → **Layer 02 CMF Core** (outreach) → **Layer 03 Human Layer** → **Layer 04 Covospan
Edge** → revenue. The pitch, paraphrased from the copy: intent signals surface a company that is
*already* in-market, before you'd otherwise know to reach out — "who should I call this week." The
copy never uses the word "scoring," only "signal"/"intent," but the implication is a single pipeline:
external signal in, qualified prospect out.

`docs/architecture-diagram.md`'s "Netjana Buyer Signal To Outreach Flow" and "Landing, Email, And
LinkedIn Lead/Event Loop" diagrams draw this as connected, working pipelines: signal normalizer →
lead context, and landing-page capture → campaign record.

## 2. What actually exists in code

Three independent, uncoordinated systems all touch `Lead.intentScore` / pipeline state. None of them
is "the" system the marketing narrative implies.

**(a) `LeadScoringService`** (`apps/api/src/modules/scoring/service/LeadScoringService.ts`) — a real
engagement-based scorer. Inputs: dwellTime, emailClicks, socialMentions (configurable weights).
Outputs `intentScore` (0-1), `leadScore` (0-100), `churnRisk`, `clusterLabel`, `optimalSendHour`.
`scoreAndPersist()` writes these **flat** (`intentScore: score.score`, no floor/max guard against a
higher existing value) and auto-advances `pipelineState` COLD→WARM→HOT, auto-enqueuing newly-HOT
leads to the caller queue. Real callers: `/scoring/batch`, `/scoring/calculate`,
`/scoring/explain[/:leadId]`, `/scoring/lead-intent`, `/scoring/persist`,
`/webhooks/lead-tracking` (email_click/dwell events), `VerificationAgent.ts`, and critically
**`handleLeadEnrichment`** (`apps/api/src/workers/handlers/enrichment-worker.ts:135-140`), which
unconditionally calls `scoreAndPersist(leadId)` after every enrichment run.

**(b) `netjanaIntelService`** (`apps/api/src/modules/intel/service/netjanaIntelService.ts`) — a
signal-strength re-weighter for *externally supplied* Netjana intent scores. `computeSignalStrength`
(lines 144-164) does real exponential freshness decay + tier/triangulation multipliers — genuine
logic — but the raw `intent_score` is whatever Netjana's payload says (line 28), not computed here.
Writes `Lead.intentScore` via `Math.max(existing, signal.intentScore/100)` (lines 709-712) — a
monotonic-max guard — but **only when `findLeadForSignal` matches an existing Lead row** (`if (lead)`
gate, line 702). No match → no write, no Lead created.

**(c) `routes/leads/[id]/journey/route.ts`** — a third, manual channel-touch state machine
(`resolveOverallState`, lines 49-94) that independently derives `pipelineState`/`status` from a
channel-event log, forward-only via `PIPELINE_RANK`. Unrelated to either scorer above.

## 3. Confirmed gaps (all verified against code, not inferred)

Ordered by severity. Gaps 1 and 2 are coupled — together they mean the engagement scorer is starved
of real input for nearly every lead, and the little signal that does arrive (from Netjana) can be
silently erased by an unrelated, ordinary action. This pair is the most damaging finding of the trace.

### Gap 1 — the engagement scorer's real inputs are wired to a different, disconnected tracking system
Confirmed by tracing the actual send flow. Real outbound emails DO embed a genuine tracking pixel and
click-redirect (`emailService.ts:41,49` → `/api/proxy/email/track/open|click/:trackingId`), and that
pixel/redirect DOES fire in production (`routes/email/track/open/[trackingId]/route.ts` →
`recordEmailOpen` → `trackingService.ts:204-205,255-256`). But that write only ever touches
`Email.openedAt` / `Email.clickedAt`. `LeadScoringService`'s engagement inputs
(`dwellTimeMinutes`/`emailClicks`/`socialMentions`) are read straight off the **`Lead`** record
(`LeadScoringService.ts:215-217,346-348`), and the only writers of those `Lead` fields are
`/webhooks/lead-tracking` (zero callers anywhere in `apps/web/src`, confirmed by repo-wide grep) and
`/scoring/lead-intent` (an API route with no confirmed caller either). **The two tracking systems
never talk to each other** — real engagement happens and is recorded, but on fields the scorer never
reads, so `hasEngagementSignals` is false for essentially every lead and every score falls back to
`freshLeadPrior`. One partial exception: `optimalSendHour`'s real branch (`LeadScoringService.ts:264-268`)
does read `Email.openedAt` directly and would self-correct once opens exist — but the primary
`intentScore`/`leadScore` calculation does not have an equivalent fallback to the data that's actually
being collected.

### Gap 2 — two scoring writers, no coordination, one can clobber the other (live, not latent)
`LeadScoringService.scoreAndPersist` writes `intentScore` flat; `netjanaIntelService` writes
monotonic-max. Traced the trigger path: `lead_enrichment` jobs (which always call
`scoreAndPersist` post-enrichment) are enqueued from `EnrichmentService.ts`,
`campaign-worker.ts` (on campaign enrollment), and two manual UI-triggered routes
(`routes/enrichment/lead`, `routes/learning/enrich-lead`). `queueNetjanaFollowup`'s own
`INTEL_FOLLOWUP_REFRESH` job (`intel-followup-worker.ts`) does **not** itself call scoring, so a
Netjana match alone doesn't immediately trigger the clobber. But if a lead that already received a
high Netjana-derived `intentScore` is later enrolled in a campaign or manually re-enriched — both
ordinary, expected user actions — `scoreAndPersist` overwrites it with the engagement-formula's
`freshLeadPrior`, which is capped at `thresholds.warm - 0.01` (0.39) when there's no engagement data
(and per Gap 1, there almost never is real engagement data). **A signal-qualified HOT lead (score
~0.8) can be silently downgraded to WARM/COLD range by an ordinary re-enrich action**, with no log,
flag, or guard against it — and because of Gap 1, the downgrade value is structurally guaranteed to
be ≤0.39, not just "lower."

### Gap 3 — Netjana signals can never create a new Lead (structural)
`netjanaIntelService.ts:702`'s `if (lead)` gate means an unmatched signal — i.e. a company Netjana
has flagged as in-market that CraftMyFunnel doesn't already have as a Lead — is silently dropped. The
`/intel` dashboard surfaces these as "Unmatched Signals — needs review" with **no action to promote
one to a Lead** (confirmed by direct read of `apps/web/src/app/(dashboard)/intel/page.tsx`).
**This means the hero page's central promise — a new, previously-unknown in-market company surfacing
automatically — has no code path that delivers it.** Netjana can only sharpen the score of a
prospect a human already entered.

### Gap 4 — `LandingLead` is a dead end
Public `/p/:slug` funnel-page form submissions are written to `LandingLead`
(`landing-agent/service.ts:579`) but never read anywhere in `apps/api` and never referenced anywhere
in `apps/web/src`. Confirmed via grep across both apps — zero hits. The "Landing, Email, And
LinkedIn Lead/Event Loop" diagram's `landingLead --> campaignRecord` edge does not exist in code.
This is the second (and only other) external-intake path, and it also dead-ends.

**Net effect of Gaps 3+4: both of the app's "new prospect enters the system" paths from outside a
human's own manual entry are non-functional.** The only confirmed `prisma.lead.create` call sites are
manual/extension entry, LinkedIn scraping, CSV import, and a non-prod seed script — all human-
initiated, none signal-driven.

### Gap 5 — `optimalSendHour` fabricates a fake data point shown to reps
`LeadScoringService.ts:275` and `:410`: when there's no real email-open history, the fallback is
`leadId.charCodeAt(0) % 2 === 0 ? 10 : 14` — a value derived from the first character of the lead's
ID, not from any signal. This is **not just an internal placeholder** — it's rendered directly to
sales reps as a specific, confident recommendation in `LeadDetail.tsx:690-691` and
`caller/page.tsx:258-259` ("Best time to reach: 2:00 PM"). Nothing in the API response or UI
discloses that this is a fabricated fallback rather than a computed one. (It does not drive any
automated send scheduling — confirmed no other caller reads this field to time actual sends — so the
harm is misleading a human, not an automation error.)

### Gap 6 — Netjana connectivity itself is unconfirmed live in production
`apps/api/src/modules/integration/mcp/netjana-server.ts:18`: `NETJANA_URL` defaults to a placeholder
(`http://netjana-api.internal`) and is absent from `.env.example`. `docs/NETJANA_SIGNAL_INTEGRATION_PLAN.md`
self-reports the webhook/scoring/dashboard path as built but flags full upstream detail-pull as
depending on `NETJANA_URL` and feature flags being live — i.e., the project's own docs treat this as
still-open. Combined with Gap 3, "Layer 01" of the hero narrative may currently be sold ahead of what
it does in production even when connected.

### Gap 7 (minor, cosmetic) — misleading naming, not misleading behavior
`clusterLabel`/"K-means" and `churnRisk`/"Churn Risk Index" in `LeadScoringService.ts` are
comment/name labels for simpler heuristics, not literal ML models. Distinct from Gap 5: the *value*
these produce is a real function of real inputs, just not the algorithm the name implies. Lower
priority than Gap 5, where the value itself is fabricated.

## 4. What's genuinely solid (not a gap)
`/intel` dashboard (`apps/web/src/app/(dashboard)/intel/page.tsx`) is fully wired to
`GET /api/proxy/intel/summary`, no mocked data. `netjanaIntelService`'s signal-strength math (decay,
tiering) is real and reasonably sophisticated. `LeadScoringService`'s core weighted formula is real
when it has engagement inputs. The channel-journey state machine is an honest, independent, working
system for what it does.
