# CraftMyFunnel Rework: US / EU / India, Competing With HubSpot, Apollo, Lemlist

Grounded in the actual codebase (`apps/web/src`), not assumptions. This sits above
`HANDOFF_user_journey_optimization.md` — that doc fixes the funnel with what's already
built; this doc says what's structurally missing to sell in three markets against three
different category leaders.

---

## 1. What you already have that they don't

- **AI-drafted outreach with a human approval step** (`modules/agent`, `/approvals`).
  Apollo and Lemlist send on autopilot or require manual writing. Neither has a governed
  review queue. This is a real differentiator — lead with it.
- **Governance/guardrails as a first-class module** (`modules/governance`, `/governance`:
  access, audit, firewall, guardrails, keys). HubSpot has none of this at your price
  point. This matters a lot for EU (GDPR) and regulated US verticals (finance, healthcare).
- **WhatsApp channel with consent handling** (`modules/whatsapp/ConsentService.ts`,
  `TemplateGuard.ts`). None of HubSpot/Apollo/Lemlist do WhatsApp outreach natively.
  This is a genuine India (and broader APAC/LatAm) wedge — don't bury it in `/tools`.
- **Multi-provider email** (Google Workspace, Microsoft Graph, SMTP —
  `modules/email-campaigner/providers/`). Matches Lemlist/Apollo's provider flexibility.

## 2. What's missing or broken, by severity

### Blocker — billing only works for India
`modules/billing/service/billingService.ts` is hardcoded to Razorpay, `currency: string
= "INR"`. There is no Stripe integration anywhere in the codebase. This means a US or EU
self-serve signup cannot pay you today — not a UX gap, a hard wall. Before any US/EU
marketing spend: integrate Stripe for USD/EUR/GBP, keep Razorpay for INR, and route by
signup region or IP/billing address. This is the single highest-priority item in this
whole document.

### Blocker — no multi-step sequence engine
Grepped `modules/email-campaigner` and `app/(dashboard)/campaigns` for step/delay/wait
logic — found none. Apollo and Lemlist are built entirely around multi-step sequences
(email 1 → wait 3 days → if no reply, email 2 → if opened but no reply, email 3, etc.).
Right now CraftMyFunnel's campaign engine looks single-touch. Without sequencing, you
are not feature-competitive with either — this is the core of what those products sell.
Scope this as its own workstream, not a small addition to `modules/email-campaigner`.

### High — enrichment has a service but no UI (already flagged in the handoff doc)
Can't credibly compete with Apollo (whose entire pitch is data + enrichment) while
`EnrichmentService.ts` has zero UI surface. Fix per Step 13 in the handoff doc, but
treat this as market-positioning-critical, not just a funnel nit.

### High — lead scoring invisible (already flagged in the handoff doc)
HubSpot's whole growth loop is score → prioritize → act. You have the scoring engine;
it's not shown anywhere except `/caller`. Fix per Step 10.

### Medium — compliance coverage is real but incomplete per region
`modules/compliance/ResidencyLockService.ts` exists (data residency control — good, this
is a real EU/GDPR requirement most competitors bolt on late). But confirm before claiming
compliance in marketing:
- **EU (GDPR):** consent capture on lead import, right-to-erasure flow, DPA availability,
  and EU data residency actually enforced by `ResidencyLockService.ts` — verify it's wired
  to storage/processing, not just a config flag.
- **US (CAN-SPAM/TCPA):** every outbound email needs a physical mailing address and a
  working one-click unsubscribe. Check `modules/email-campaigner/service/emailComposer.ts`
  for this — if it's not there, it's a legal requirement, not a nice-to-have.
  TCPA also applies if you add SMS/calling (`modules/caller`) in the US — routing
  WhatsApp/SMS consent rules across borders without adjustment is a real compliance risk.
- **India (DPDP Act 2023):** consent-first processing of personal data. You already have
  `ConsentService.ts` for WhatsApp — extend the same consent pattern to email/CSV import
  so it's not WhatsApp-only.

### Medium — no region-aware pricing
`PricingPage.tsx` reads a `currency` field from an API response but billing itself is
INR-only (see Blocker above). Once Stripe is in, decide: flat USD/EUR pricing (simpler,
what most SaaS does) vs. PPP-adjusted pricing for India (what actually drives India
volume — ₹ pricing converts far better locally than $ pricing shown in INR).

### Low — send-time localization
Multi-market outreach needs timezone-aware send windows (don't email a US prospect at
3am their time because the campaign was scheduled in IST). Check whether
`emailComposer.ts` / scheduling logic accounts for recipient timezone — if not, add it
alongside the sequencing work above, since sequences and send-time windows are usually
built together.

## 3. Where hidden features fit the market story

From the `/tools` audit in the handoff doc, two hidden features are specifically
relevant to going multi-market and should move up in priority for that reason alone:

- **LinkedIn Runner** (`modules/linkedin-runner`) — LinkedIn-first outreach is much
  stronger in EU/US B2B than India-first WhatsApp motion. Surfacing this as a channel
  option directly supports the US/EU push, same as WhatsApp supports India.
- **Knowledge Base / RAG** (`modules/knowledge`, `modules/rag`) — grounding AI drafts in
  company/region-specific knowledge (compliance language, local terminology) matters more
  once you're drafting for three different regulatory and cultural contexts, not one.

## 4. Priority order (do this, in this order)

1. Stripe integration for USD/EUR — nothing else in this doc matters commercially for
   US/EU until people can pay.
2. Lead scoring on `/leads` (Handoff Step 10) — proves the core promise, cheap to build,
   already scoped.
3. Multi-step sequence engine — the single biggest feature gap vs. Apollo/Lemlist.
   This is a real project, not a patch; scope it separately with me before starting.
4. Enrichment UI (Handoff Step 13) — needed for scoring to mean anything and for the
   Apollo-style data pitch to hold up.
5. Playbooks + Hunter surfaced in the funnel (Handoff Steps 11-12) — cheap wins, already
   built, just hidden.
6. Compliance verification pass (GDPR erasure flow, CAN-SPAM footer/unsubscribe, DPDP
   consent extended beyond WhatsApp) — do this before any paid US/EU marketing, it's a
   legal exposure question, not a roadmap nice-to-have.
7. Region-aware pricing + send-time localization — once 1-4 are done and you're actually
   running US/EU campaigns.

Items 2, 4, 5 reuse the file references already listed in
`HANDOFF_user_journey_optimization.md`. Items 1, 3, 6, 7 are new workstreams — want me to
draft a separate Claude Code handoff prompt for the Stripe integration and the sequence
engine specifically? Those two are big enough that they shouldn't be bundled into the
journey-fix prompt.
