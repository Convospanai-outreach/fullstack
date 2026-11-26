# CraftMyFunnel product requirements

Status: living document. Last checked against code: 2026-11-16.
Supersedes `docs/v1-beta-scope.md` (email-first beta scope, now historical).
Owner decisions are marked "Decision". Anything not proven from code says so.

## 1. Problem

Teams use AI to write outreach. The person accountable for it, the manager, cannot see
what was sent, to whom and why, before it goes out and after it lands.

CraftMyFunnel is built for that manager. Reps prepare. Nothing goes out until a human
approves the exact message. Every decision is recorded.

## 2. Positioning

- A governed outreach workspace across email, LinkedIn, WhatsApp and calls.
- A control layer, not a contact database. It works on leads the team already has:
  imports, LinkedIn capture, NetJana buyer signals.
- Edge: approval enforced at the API, a decision record without message text, and an
  optional on-premise edge node that keeps personal data on the customer's device.
- Not: autonomous sending, guaranteed meetings, the biggest database.
  Claim wording follows "Product Claim Guardrails" in `AGENTS.md`.

## 3. Users

| User | Job | Lives in |
|---|---|---|
| Manager or owner (primary buyer) | Approve or reject drafts, watch pipeline and team, prove control | Home, approvals, governance |
| Rep | Work leads, prepare drafts, answer replies, do manual LinkedIn and call steps | Inbox, Leads, lead detail, Caller |
| Admin | Connect channels, set policy, manage team, billing | Setup, Settings |

Outreach mode (setup step 1): "My own lead generation" (personal) or "On behalf of a
company" (company). Personal mode hides brand, handoff and team steps.

## 4. Core loop

signal or import -> lead -> channel -> AI draft -> human approval -> send or rep task ->
record the touch -> capture the reply -> next step -> meeting.

## 5. Principles (apply to every feature)

1. Approval before any automated send, on every channel. Never shortened or defaulted.
2. No fake numbers. Missing data shows a blank state that says what will appear.
3. One lead, one history. The channel is a label on a touch, not a separate place.
4. Under-claim. A channel or feature is described as live only when `GEMINI.md` §14 says so.
5. Team scope on every read and write.

## 6. Decisions

| Date | Decision |
|---|---|
| 2026-11-16 | Multichannel for all users (Email, LinkedIn, WhatsApp, Calls), not an email-first beta. Code flag `emailFirstBeta` is still `true`; removal waits for owner OK. |
| 2026-11-14 | Home rework keeps the current theme; new look is a separate, later decision. |
| 2026-11-14 | Home shows blank states with next steps, never zeros, for a new account. |

## 7. Requirements and current state

Status: **Live** works end to end in code. **Gaps** works with known holes.
**Stub** looks present, does not do the job. **Not built**. **Not verified** nobody checked.

### Channels (detail and evidence: `GEMINI.md` §14)

| Channel | Requirement | Status | Open work |
|---|---|---|---|
| Email | Send from connected mailbox (Google, Microsoft 365, SMTP, Resend) after approval; capture replies | Live | No sent timestamp on `Email`; reply capture is Gmail pipeline in apps/api |
| WhatsApp | Send from team's Business account, consent checked, replies and opt-outs captured | Gaps | OPEN-361 not via `ApprovalRequest`; OPEN-362 no `teamId` or delivery status; OPEN-363 missing account parks enrollment; OPEN-364 not in Inbox; OPEN-365 webhook config unconfirmed |
| LinkedIn | Steps become rep tasks; touches recorded; replies captured | Stub (runner only scrapes) | Reply capture; honest task flow; no automated sending claims |
| Calls | Call task, outcome logged, consent checked | Stub (hand-off queue only) | Call record, outcome, consent check |

### Workspace

| Area | Requirement | Status | Open work |
|---|---|---|---|
| Setup wizard | Fastest path to first approved draft; rest deferrable | Gaps: 15 steps, none audited as required | Audit then shortest path (`ONBOARDING.md`) |
| Home | What needs me, KPIs, pipeline, channels, approval record | Live since PR #963 | Full draft text in sign-off card; calls row; LinkedIn replies |
| Approvals | Approve, edit, reject the exact text; expiry; record | Live for email | WhatsApp not routed through it (OPEN-361) |
| Inbox | One inbox for all channels, reply in lead's channel | Gaps: email only | Unified inbox after channel data gaps close |
| Lead detail | One timeline across channels: signal, draft, approval, send, reply | Not verified | Build on MCP `get_lead_timeline` data |
| Leads list | Filters, bulk actions behind approval, last touch and channel | Gaps: filters exist; no last-touch column | Last touch, next step, saved views |
| Campaigns | Sequence by channel, per-step and per-channel results | Gaps: sequence and variants exist, results email-centred | Per-channel results; six-step rail needs a data mapping first |
| Pipeline | Stages Cold to Completed with stuck leads flagged | Gaps: kanban exists, no channel or days-in-stage | Last channel, days in stage, owner |
| Governance record | Approvals and outcomes without message text or personal data | Live on Home (last 5) | Per-campaign log tab |
| Intent score | Score with explained inputs (dwell 40, click 35, social 25) | Live (badge tooltip, PR #946) | |
| Edge node | Status, pairing, personal data removed on device | Gaps: header chip live (PR #944); settings panel not built | Panel; migration `20260604140000` is red, do not run |
| Billing and credits | Credit reservation and settlement on AI use | Live (apps/api `aiService`) | Pricing page not reviewed for this PRD |
| MCP | Agents prepare, humans approve exact arguments | Live (`docs/MCP_INTEGRATION.md`) | |

## 8. Roadmap priorities

P0, before more UI:
- Prove multi-tenant isolation with real queries (`GEMINI.md` §12 open item).
- Data honesty fixes: churn on new leads, raw `1e-7`, hardcoded velocity, two readiness numbers.
- WhatsApp sends through `ApprovalRequest` (OPEN-361).
- Record LinkedIn replies and call outcomes, or keep them labelled "Not tracked yet".
- Fix the design token pipeline (`docs/design/DESIGN_SYSTEM.md` §1).

P1:
- Cross-channel timeline on lead detail.
- Unified inbox.
- Setup wizard shortest path to first approved draft.
- Home sign-off card with the full draft text.

P2:
- Next-best-channel suggestion (suggest only; a human approves).
- Manager view per rep: pending approvals, response time, rejections.
- Campaign six-step rail, once a lead-to-step mapping exists in data.
- New look (light blue sidebar, new fonts), after token fix.

## 9. Non-goals

- Own contact database.
- Sending without human approval.
- New channels (SMS, Instagram DMs) before the four existing ones share one inbox and timeline.
- Public "multichannel" or "LinkedIn automation" claims before `GEMINI.md` §14 rates them live.

## 10. Success measures

North star: time from signup to first approved draft.
Funnel: signup, setup step completed, first lead, first draft, first approval, first send,
first reply, first meeting. Instrumentation is planned, not built.
Baselines and targets: `docs/product/BENCHMARKS.md` (empty until measured).
No number is quoted until it is measured in this app.

## 11. Open decisions (owner)

- Edge device name: "Covospan EDGE" or "Sovereign Wall".
- Remove `emailFirstBeta` once WhatsApp gaps close.
- Does merge to `main` deploy without a human step? (`MASTER_SYSTEM_ARCHITECTURE.md`
  says web deploys manually or six-hourly; API deploys on merge.)
- Sidebar light blue value and new fonts.
- Pricing and plan names (not reviewed here).

## 12. Related docs

`GEMINI.md` (rules, §8 product map, §14 channels), `MASTER_SYSTEM_ARCHITECTURE.md`,
`docs/product/` (FEATURE_INVENTORY, GLOSSARY, DATA_SOURCES, ONBOARDING, BENCHMARKS),
`docs/design/DESIGN_SYSTEM.md`, `docs/BRAND_VOICE_GUIDELINES.md`,
`craftmyfunnel-product-narrative.md` (positioning narrative), `OPEN_ITEMS.md` (search it).
