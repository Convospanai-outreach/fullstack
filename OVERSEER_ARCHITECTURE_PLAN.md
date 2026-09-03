# The Overseer Layer

**Architecture proposal — plan only, no implementation.**
Scope: `apps/api` agent & automation stack.

An OpenRouter-backed supervisory service and human-in-the-loop (HITL) tiering model for CraftMyFunnel's existing agent runtime — proposed as an extension of what's already running, not a replacement for it.

---

## 00 · Current state

This is not a greenfield AI build. The agent runtime, multi-provider LLM gateway, and a human-approval layer already exist and run in production.

The relevant pieces already in `apps/api`:

- **Agent runtime** — `AgentExecutor` is a state machine (PLANNING → SANITIZATION → LLM_GENERATION → ADVERSARIAL_CHECK → EXECUTION → AWAITING_APPROVAL → QUEUED_OFFLINE) driven by a `ToolRegistry`.
- **Model gateway** — `ModelGateway` / `MicroLLMClient` already abstract over Anthropic, OpenAI, Gemini, and Groq SDKs directly.
- **Governance** — `ApprovalService`, `TrustEngine`, `ComplianceGuard`, and a `GuardrailPolicy`/`GuardrailLog` pair already gate the EXECUTION → AWAITING_APPROVAL transition, backed by a `ManualReview` table.
- **Job infrastructure** — a Postgres-backed queue (`JobQueue`) with claim/lease semantics, polled by a `worker-manager` across sequence, campaign, email, enrichment, and warmup handlers.
- **Traceability** — `AiTrace`, `LLMUsageLog`, `AgentLog`, `EventStore`, and `FeedbackLoopService` already capture what agents did and why.

**Implication:** the two things asked for — an OpenRouter-based oversight service, and HITL automation — are additions to this stack, not new subsystems built from zero. The plan below names exactly which existing file each new piece sits beside or inside.

---

## 01 · Why an overseer, and why OpenRouter

**The gap today:** guardrails currently live *inside* each agent run — `TrustEngine` and `ComplianceGuard` score a single execution against policy before it's allowed to act. Nothing today watches *across* runs: cost drift across providers, an agent that's technically passing guardrails but drifting off-ICP, a sequence-branching decision that's statistically anomalous versus the last 30 days, or a provider outage silently degrading output quality. That's a second, slower loop — supervisory rather than transactional — and it should not live inside the hot path of `AgentExecutor`.

**Why OpenRouter specifically for this piece:** the existing `ModelGateway` already juggles four SDKs directly (Anthropic, OpenAI, Gemini, Groq) for *execution*-path calls, where provider-specific features (prompt caching, tool-use formats) matter and justify direct SDKs. The Overseer's calls are different in kind — periodic, low-frequency, model-agnostic judgment calls ("does this batch of agent decisions look right?") where you want cheap model diversity, automatic fallback if one provider is down, and one bill and one rate-limit surface to reason about. That's OpenRouter's actual value proposition, and it's a poor fit for the primary execution path, which is why this plan scopes it to the Overseer only.

> **Explicit boundary:** this plan does **not** propose routing `AgentExecutor`'s LLM_GENERATION calls through OpenRouter. Those stay on `ModelGateway`. OpenRouter is scoped to the new Overseer service only. Revisit that boundary later if it proves wrong — don't widen it up front.

---

## 02 · The Overseer service — nudge, not mutate

**Operating principle:** the Overseer's power is narrowed to match its job. It observes, it suggests, it never writes to a lead, sequence, campaign, or mailbox record itself. This closes the sharpest failure mode from the risk review below (§08 #1): an Overseer with mutation power is a second, less-audited execution path running alongside `AgentExecutor`; an Overseer that can only nudge has no new blast radius — the whole risk question becomes "is the suggestion well-targeted," not "can the Overseer break something."

**Primary job — keep the funnel moving.** Its core, always-on function is watching for stalled leads and sequences: an enrollment that's sat at a stage far longer than the historical baseline for that stage, with no reply, no bounce, no next step recorded. It does not fix the stall. It surfaces it.

**What triggers a nudge:** a `SequenceEnrollment` / `SequenceStepRun` whose dwell time at the current stage exceeds the historical p90 baseline for that stage and sequence type — not a fixed timeout, since "stalled" means different things for a 3-step vs. a 12-step sequence.

**What a nudge is:** a suggestion record (new `OverseerNudge`), not a command. It names the lead, the sequence, the stage, the stall duration, and a suggested next action ("re-send step 3, variant B," "route to manual outreach," "likely dead lead — exit sequence"). It lands in the reviewer queue from §03 as a low-priority nudge category, alongside approval requests, where a human decides whether to act.

**What it does not do:** call a tool, write to `SequenceEnrollment` / `SequenceStepRun` / `Lead`, advance a step, or send anything. If a nudge should become an action, an existing agent or human takes it — the Overseer's write surface stops at `OverseerNudge` and `ShadowSignal` (its secondary function: flagging guardrail/compliance/cost anomalies into `ApprovalRequest`, per §01).

**Efficacy & TAT — the two numbers this component lives or dies by:**

- **Efficacy** — of nudges emitted, what fraction were acted on, and of those acted on, did the lead/sequence actually resume (next `SequenceStepRun` recorded, reply, or conversion) within N days, versus a matched control that got no nudge. Tracked per nudge type; retire types that don't move the needle.
- **TAT (turnaround time)** — stall detected → nudge emitted → nudge acted on → funnel resumed. Reported as a distribution (p50/p90), not an average — one stuck reviewer skews an average and hides the real story. TAT is also the number that tells you whether the reviewer queue itself (§03), not the Overseer, is the bottleneck.

Both numbers surface in a small panel on `/review` — no new service, just a query over `OverseerNudge` joined against `SequenceStepRun` / `EmailEvent` outcomes.

**What it actually does, concretely:**

- **Batch review, not per-request** — runs on a scheduler tick (reusing `schedulerService`, not a new cron mechanism), e.g. every 15–30 min, reviewing the delta since its last run.
- **Model-agnostic judgment via OpenRouter** — asks 1–2 cheap models "does this batch of agent actions / stalled enrollments look consistent with policy and historical baseline," with a stronger model as tie-breaker on disagreement or high-stakes categories.
- **No execution authority** — the Overseer cannot pause a worker, cannot mutate a live sequence, cannot send. Its only write paths are "flag," "nudge," and "escalate." This keeps its blast radius small and its own hallucinations non-destructive.
- **Runs as its own worker handler** — `apps/api/src/workers/handlers/overseerHandler.ts`, registered in `worker-manager` alongside the existing handlers, not a new service/deployment.

---

## 03 · HITL tiering model

`ApprovalService` and `ManualReview` already exist but are used ad hoc. This formalizes a three-tier risk model on top of them, so "does this need a human" is a policy decision, not a per-feature one.

| Tier | Trigger examples | Behavior |
|---|---|---|
| **Auto** | Sequence step advance within an approved template; enrichment lookups; warmup mailbox rotation | Executes immediately. Overseer reviews after the fact, in-batch — never blocks. |
| **Queued approval** | New sequence variant generated by the landing/copy agent; ICP-boundary lead added to a live campaign; first send from a newly warmed mailbox | Writes an `ApprovalRequest`, queues the job (existing `QUEUED_OFFLINE` state), surfaces in a reviewer queue. Executes on approval; auto-denies on timeout (default 24h, configurable per policy). |
| **Hard block** | Guardrail failure; Overseer anomaly flag on a live-send action; compliance-sensitive content (e.g. claims language); spend spike past budget threshold | Blocks unconditionally. Requires explicit reviewer action — no timeout auto-behavior. Logged to `ImmutableAudit`. |

**Reviewer surface:** the gap isn't the data model (`ApprovalRequest`/`ManualReview` already hold what's needed) — it's that there's no dedicated UI to act on it. Proposed: a `/review` route in `apps/web` showing the pending queue grouped by tier, with a diff view (before/after for sequence edits, rendered preview for email/landing copy) and one-click approve/reject/edit-then-approve. Approve/reject decisions write back to `AgentFeedback`, closing the loop the Overseer reads from.

---

## 04 · Backlog circuit breaker

Answers failure mode #9 (§08): what the system does, automatically, when the reviewer queue backs up — before denial rate and stall rate compound into the reinforcing loop described there.

**States** — the classic breaker pattern, applied to a data-driven trigger rather than request latency:

- **CLOSED (normal)** — timeouts and nudge emission run at configured defaults.
- **OPEN (tripped)** — a monitored metric crossed its trip threshold; system behavior changes per below.
- **HALF-OPEN (recovering)** — metrics have held under a lower reset threshold for a sustained window; breaker returns to CLOSED if they stay there.

**What trips it** — evaluated on each Overseer scheduler tick (§02), any one condition sufficient:

- Queued-approval depth exceeds a threshold (e.g. 50 open items, configurable).
- Queued-approval TAT p90 over a rolling 6h window exceeds a threshold (e.g. 12h — halfway to the 24h auto-deny timeout).
- Deny rate — timeout-denials as a fraction of items resolved, over a rolling window — exceeds a threshold (e.g. 40%). This is the sharpest signal, since depth alone doesn't distinguish "queue is busy" from "queue is failing": deny rate does.

**What OPEN actually changes** — deliberately limited to non-mutating, reversible levers, consistent with the Overseer's "nudge, not mutate" boundary from §02:

1. **Alert** — mandatory, first action. Notifies the queue owner (§09) through existing channels; no new alerting infrastructure.
2. **Extend queued-approval timeouts** (e.g. 24h → 72h) while OPEN, so a growing backlog doesn't convert into a wave of denials just because reviewers are underwater — buys time without giving up the "still needs a human" property.
3. **Throttle new nudges** — raise the stall threshold or cap nudges emitted per batch while OPEN. This directly breaks the reinforcing loop in failure mode #9, where timeout-denials cause stalls that generate more nudges that add to the same backlog.
4. **Hard-block items are explicitly untouched.** No timeout is added; nothing changes for them under OPEN. They already have no automatic behavior, and the breaker doesn't invent one under load — it does not solve the "hard-block items just sit" half of failure mode #9, only the compounding queued/nudge half.

**What OPEN does not do:** no auto-approve, no auto-unblock, no bypassing a tier. The breaker can only make the system wait longer and escalate less — never act on a human's behalf. Widening this would reopen failure mode #1.

**Recovery (HALF-OPEN → CLOSED):** reset thresholds sit below trip thresholds (hysteresis, to avoid flapping) — e.g. queue depth back under 20 and deny rate under 15%, held for 30 continuous minutes. Once held, timeouts and nudge volume return to their defaults.

**Where it lives:** computed in the same Overseer batch tick as §02, writing one `BreakerState` row consumed by (a) the timeout logic in `ApprovalService`, (b) nudge-emission volume in the overseer handler. No new service — a status pill (CLOSED / OPEN / HALF-OPEN) on the `/review` dashboard, next to the efficacy/TAT panel from §02, makes state visible to reviewers in real time.

Priority ordering within a tier (§09) is a separate, still-open question — the breaker changes *how much* pressure the queue is under, not *what order* it's worked in.

---

## 05 · Control flow

```
 Agents                Trust / Guardrail         AiTrace / EventStore
 (AgentExecutor,   →    (in-line, per-run)   →    (append-only log)
  workers)
                                                          │
                                                          ▼
                                              ┌───────────────────────┐
                                              │       Overseer        │
                                              │ OpenRouter · scheduled │
                                              │     batch review       │
                                              └───────────┬────────────┘
                                     ┌────────────────────┼────────────────────┐
                                     ▼                    ▼                    ▼
                             Auto-continue         ApprovalRequest         Hard block
                             (tier: auto)          (tier: queued)         (tier: crit)
                                                          │                    │
                                                          └─────────┬──────────┘
                                                                    ▼
                                                          Reviewer queue (/review)
                                                             human decision
```

Overseer flags and escalates; it never executes, pauses, or sends on its own authority. The circuit breaker (§04) sits alongside this flow, watching queue depth/TAT/deny-rate and adjusting timeout and nudge-volume behavior — it is not drawn as a separate box here since it modifies the existing paths rather than adding a new one.

---

## 06 · Build vs. reuse

Naming this explicitly so scope doesn't drift into a rebuild.

| Capability | Source |
|---|---|
| Agent execution & tool calling | Reuse — `AgentExecutor`, `ToolRegistry` |
| Per-run policy gating | Reuse — `TrustEngine`, `ComplianceGuard`, `GuardrailPolicy` |
| Approval data model & queueing | Reuse — `ApprovalService`, `ApprovalRequest`, `QUEUED_OFFLINE` state |
| Job scheduling | Reuse — `schedulerService`, `worker-manager` |
| Audit trail | Reuse — `AiTrace`, `ImmutableAudit`, `EventStore` |
| Cross-run anomaly review | **New** — Overseer handler + OpenRouter client |
| Risk-tier policy table | **New** — formalizes existing ad hoc approval calls into one tier config |
| Reviewer UI | **New** — `/review` in apps/web |
| `OverseerVerdict` record | **New** — one Prisma model + migration |
| `OverseerNudge` record + efficacy/TAT query | **New** — one Prisma model + `/review` dashboard panel |
| `BreakerState` record + trip/reset logic | **New** — one small table + logic in the overseer handler and `ApprovalService` timeout path |

---

## 07 · Phased rollout

### 01 · Tier the existing approval points — ~1 week
Audit every place `ApprovalService` is already called or should be; assign each a tier from §03. No new code beyond a config table — this alone should surface which "auto" actions are currently under-governed and which "queued" actions are currently blocking unnecessarily.

### 02 · Reviewer queue UI — ~1–2 weeks
Ship `/review` against the existing `ApprovalRequest`/`ManualReview` data — this alone makes today's governance layer usable by a human, independent of the Overseer existing yet.

### 03 · Overseer v0 — flag only — ~2 weeks
Batch review job via OpenRouter, writing `ShadowSignal` only (no escalation yet). Run it silently against production traffic to tune signal-to-noise before it can affect a queue a human has to look at.

### 04 · Wire escalation — ~1 week
Overseer flags start writing real `ApprovalRequest`s into the tiered queue from Phase 01–02. Start with hard-block categories only; expand to queued-approval once false-positive rate is known.

### 05 · Circuit breaker — ~1 week
Wire the trip/reset thresholds from §04 into the timeout logic and overseer handler, once real queue-depth and TAT data from Phases 02–04 exist to set sane defaults. Ship the CLOSED/OPEN/HALF-OPEN status pill on `/review` alongside it.

### 06 · Close the loop — ongoing
Reviewer decisions feed `AgentFeedback` / `FeedbackLoopService`; periodically review whether tier assignments, Overseer thresholds, and breaker trip points should move, based on approve/reject ratios and how often the breaker actually trips.

---

## 08 · Known failure modes

Carried over from risk review, with current mitigation status.

| # | Failure mode | Mitigation in this plan |
|---|---|---|
| 1 | Auto-tier actions execute before any review — damage possible in the batch-window blind spot | Partially mitigated for the funnel-stall use case: nudges are advisory only, so this risk shifts from "did the Overseer catch it" to "did a human act on the nudge in time" — tracked directly via **TAT**, not assumed away. |
| 2 | Tier misclassification — who tiers the tiers | **Unresolved.** Still needs an owner for Phase 01's tier audit and a re-audit cadence as the product changes. |
| 3 | LLM-as-judge unreliability (false positive/negative nudges and flags) | Partially mitigated: **efficacy** metric exists specifically to catch this — nudge types with poor efficacy get retired. But there's a cold-start period before that data exists. |
| 4 | Reviewer fatigue collapses "queued" into "auto" via rubber-stamping | **Unresolved.** TAT p90 will *surface* a queue-depth problem, but doesn't prevent fatigue-driven bad approvals. |
| 5 | Silent stall on timeout auto-deny | Unresolved for approval-tier; not applicable to nudges (nudges have no timeout — an unactioned nudge just keeps accumulating TAT, which is visible in the dashboard rather than silently expiring). |
| 6 | PII/compliance exposure sending trace and lead data to OpenRouter | **Unresolved.** No redaction step defined yet — needs one before Phase 03. |
| 7 | Overseer dependency on OpenRouter uptime | Low-stakes by design: since the Overseer never mutates or gates in real time, an OpenRouter outage just means nudges/flags pause — no other system depends on its liveness. |
| 8 | Feedback loop (tier/threshold tuning) never gets revisited in practice | Efficacy and TAT give the loop something concrete to look at on a cadence, but Phase 06 still doesn't name an owner or a recurring review slot. |
| 9 | Reviewer queue backs up | **Partially mitigated by the circuit breaker (§04).** Queued-approval items still fail *closed* on timeout by default, and hard-block items still have no automatic behavior — those properties are unchanged. But once queue depth, TAT p90, or deny-rate crosses a trip threshold, the breaker now alerts, extends timeouts, and throttles new nudge volume automatically — breaking the reinforcing loop where denials cause stalls that generate more nudges. **Still unresolved:** priority ordering within a tier (§09) — the breaker changes queue *pressure*, not *order*, so a trivial item can still sit ahead of an urgent one even while OPEN. |

---

## 09 · Open questions

- **Which OpenRouter models** for the Overseer's review pass, and at what budget — this drives review frequency and tie-breaker cost.
- **Who reviews the queue** day to day — a named role/team, and what SLA on the 24h queued-approval timeout is acceptable before it starts silently auto-denying.
- **Auto-deny vs. auto-approve on timeout** for the queued approval tier — this plan defaults to deny-on-timeout (safer) but that trades off against sequence timing sensitivity. (Nudges, per §02, don't time out at all — they accumulate TAT instead.)
- **Does the Overseer need write access to pause a worker** in a future phase, or does "hard block on next action" stay sufficient — deliberately deferred rather than assumed.
- **What counts as "stalled" per funnel/sequence type** — nudge thresholds are only as good as the per-stage baseline behind them, and that baseline doesn't exist until there's enough historical `SequenceStepRun` data to compute a p90 from.
- **Do nudges ever reach an agent directly, or stay human-only** — this plan keeps nudges human-only in v0 (routed to `/review`); an agent auto-acting on a nudge would reopen failure mode #1 and needs its own review before being considered.
- **Who owns re-tiering §03's classifications and reviewing efficacy/TAT trends** — flagged in failure mode #2 and #8 as currently unresolved.
- **How are items ordered within a tier** — plan defaults to FIFO today, which lets a trivial nudge sit ahead of a time-sensitive approval, even with the circuit breaker (§04) OPEN. Needs a priority scheme before Phase 02 ships.
- **Exact trip/reset threshold values for the circuit breaker (§04)** — the numbers in that section (50 items, 12h TAT, 40%/15% deny-rate) are starting points, not measured defaults; Phase 05 sets them from real Phase 02–04 data.
