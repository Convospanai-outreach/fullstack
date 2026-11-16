# Feature inventory: what must not change without approval

Purpose: UI, copy and onboarding work may change order, defaults, wording and layout.
It may not remove, rename or change the behaviour of anything listed here unless the
human says so in the task. If a task seems to need that, stop and ask.

Facts only, taken from code on 2026-11-16. Update in the same PR that changes a fact.

## Core loop (see GEMINI.md §8 for sources of truth)

lead -> channel -> AI draft -> human approval -> send -> track reply and outcome.
The human approval step is deliberate friction. Never shorten, default or bypass it.

## Main navigation (signed-in)

Home (`/dashboard`), Inbox, Leads, Campaigns, Pipeline, Content, Reports, Settings.

## Signed-in route groups (`apps/web/src/app/(dashboard)/`)

accounts, admin, agents, analytics, approvals, audit-logs, automations, billing, calendar,
caller, campaigns, command-center, content, crm, crystal-knows, csv-ingestion, dashboard,
edge, governance, hunter-email-finder, icp-builder, inbox, intel, jobs, knowledge,
landing-agent, leads, linkedin-runner, marketplace, monitoring, notifications, pipeline,
playbooks, profile, runtime, scraper-bridge, settings, sovereign, studio, team, templates,
tools, whatsapp, workflows.

Every URL above must keep resolving. Do not delete or merge pages.

## Hidden features (`apps/web/src/lib/productFlags.ts`)

`PRODUCT_FLAGS.betaMode = true`, `PRODUCT_FLAGS.emailFirstBeta = true`.
`emailFirstBeta` only does four things: hides the "CRM sync" settings link, sets the
sidebar plan label to "Enterprise", marks setup step 11 done without WhatsApp, and shows
the "Advanced channels deferred safely" line in setup.

Features that exist behind the hidden-features switch (19 keys): agents, caller,
command-center, creator-funnel, crystal-knows, csv-ingestion, edge, hunter-email-finder,
jobs, knowledge, linkedin-runner, marketplace, playbooks, runtime, scraper-bridge,
sovereign, studio, whatsapp, workflows.

On by default for a team that never customised features (`DEFAULT_ON_HIDDEN_FEATURES`):
linkedin-runner, whatsapp, caller, playbooks, studio, hunter-email-finder, csv-ingestion,
workflows, agents, jobs, knowledge, command-center. Off until a team turns them on or
they pass their readiness rule: creator-funnel, crystal-knows, edge, marketplace, runtime,
scraper-bridge, sovereign. What each channel really does today: GEMINI.md §14.

Do not surface an off-by-default feature in default UI, and do not remove a flag, without approval.

## Settings sections (`/settings/*`)

agent, approvals, audit, branding, budgeting, crm, crystal-knows, custom-properties,
domain-health, features, general, governance, guardrails, hitl, keys, mailboxes,
notifications, payments, social, sso, suppressions, team, webhooks.

Grouping and search may change. Section URLs and what each saves may not.

## Setup wizard (`/setup`)

15 steps with fixed ids. Detail in `docs/product/ONBOARDING.md`.
Fixed: step ids (deep links like `/setup?step=3`), personal vs company mode, the data
responsibility notice in step 1, and the redirect to `/setup` until outreach mode is chosen.

## Approvals

- Model `ApprovalRequest`: status PENDING / APPROVED / REJECTED; tier AUTO / QUEUED / HARD_BLOCK;
  `autoDenyAt` auto-rejects QUEUED requests past that time.
- Approve from Home: `POST /api/approvals/:id` with `{ action: "APPROVE" }`.
- MCP approval mechanism (requestId, exact-argument binding, expiry, no double-apply):
  do not change. See `docs/MCP_INTEGRATION.md`.

## Home page (`/dashboard`)

Sections in order: needs-you headline and queue, monthly meeting goal, KPI strip,
pipeline stages, outreach by channel, approval record, pipeline trend, recent leads,
setup checklist (while setup is incomplete), activity feed.
APIs: `/api/dashboard/summary`, `/api/dashboard/overview`, `/api/proxy/dashboard/needs-you`,
`/dashboard/meeting-goal` (apps/api).

## Never touch from a UI task

Billing and credit enforcement, auth, permissions and team roles, Prisma schema and
migrations, AI guardrails (`aiService.ts`, `aiInputGuardrails.ts`), edge signing and
`HARDWARE_SIGNATURE`, intent score formula (dwell 40 / click 35 / social 25),
migration `20260604140000_edge_runtime_pairing` (do not run).
