# Persistent Open-Items Ledger

**Last Reconciled:** 2026-07-27

---

## Open & Resolved Items

| ID | Item | Category | Status | Details / Evidence Requirement |
|----|------|----------|--------|--------------------------------|
| **OPEN-01** | Multi-Tenant Data Isolation | Security | **Resolved** | Verified write (`updateMany`), read (`findFirst`), and delete (`deleteMany`) paths enforce `teamId` scoping. Live test `scripts/test-tenant-isolation.mjs` confirmed Team A update/read/delete on Team B lead returns 0 rows modified. `getCurrentContext()` derives `teamId` from server-verified Clerk/NextAuth JWT; `convo-workspace-id` cookie is membership-validated before use. |
| **OPEN-02** | Remote GitHub Actions CI Execution | CI/CD | **Resolved** | Remote GitHub Actions CI run `#30352553274` completed with status `success` on remote repository `Convospanai-outreach/fullstack`. URL: [`https://github.com/Convospanai-outreach/fullstack/actions/runs/30352553274`](https://github.com/Convospanai-outreach/fullstack/actions/runs/30352553274). |
| **OPEN-03** | Google OAuth CASA Assessment | Compliance | **Deferred** | Human action required in Google Cloud Console / CASA portal. |
| **OPEN-04** | Azure AD App Registration (Microsoft OAuth) | Integrations | **Deferred** | Human action required in Azure Portal. |
| **OPEN-05** | Live Gmail RFC 5322 Message-ID Reply Detection | Verification | **Still Open** | Empirical live send → reply cycle test needed. Code-level wiring is correct in both `apps/web` (post-send wire header fetch) and `apps/api` (full `In-Reply-To`/`References` matching in `createInboundCampaignEvent`). Needs one live cycle to confirm Gmail preserves the wire Message-ID. |
| **OPEN-06** | Dashboard Stat Cards Database Backing | Audit | **Resolved** | All four primary stat cards use real `teamId`-scoped Prisma queries — no hardcoded fakes. Evidence: `prisma.meeting.count({ where: { teamId } })` (Meetings), `prisma.lead.count({ where: { teamId, status: { notIn: [...] } } })` (Active Pipeline), `prisma.email.count({ where: { lead: { teamId }, status: { in: ["draft","DRAFT","draft_ready","DRAFT_READY","queued","QUEUED"] } } })` (Drafts — filter expanded to include all status casings), `prisma.emailEvent.count({ where: { teamId, type: { in: ["OPENED","CLICKED","REPLY_RECEIVED"] } } })` (Signal Capture — aligned to canonical `REPLY_RECEIVED`). Delta stubs (`meetingsDelta`, `openRateDelta`) UI badge updated to render `— N/A` instead of `∅ Null`. Full audit: [`dashboard_stat_cards_audit.md`](file:///C:/Users/tewar/.gemini/antigravity-ide/brain/fce46043-36d6-4142-bd27-d2bf09b2763f/dashboard_stat_cards_audit.md). |
| **OPEN-07** | Accessibility Page Audit | UX/QA | **Still Open** | Screen-reader testing required for `/intel`, `/scraper-bridge`, `/jobs`. |
| **OPEN-08** | Production Worker Process Monitoring | Operations | **Still Open** | Docker/PM2 process supervisor confirmation for background worker loops. |
| **OPEN-09** | Gmail PubSub / History Inbound Reply Processing Engine | Architecture | **Resolved** | Consolidated solely into `apps/api`'s canonical, OIDC-verified, lease-locked pipeline (`registerGoogleMailboxWatch`, `/integrations/google/pubsub` Fastify route, `gmail-history-sync-worker.ts`, `syncGoogleMailbox`). Redundant unauthenticated implementation in `apps/web` (`syncGmailInboundReplies` and `/api/integrations/google/pubsub/route.ts`) deleted per GEMINI.md §5 single source of truth rules. HTTP 400 Bad Request handling ported to `apps/api` alongside 404 for stale history ID profile resync fallback. All 273 API tests and 134 Web tests passing. |
| **OPEN-10** | Reply Event Type Mismatch (apps/api vs apps/web) | Data Integrity | **Resolved** | `apps/api` `createInboundCampaignEvent` wrote event type `"REPLY"` while web consumers expected `"REPLY_RECEIVED"`. Unified `apps/api` `GmailInboundEventType` and `assertCompletedInboundEvent()` check to `"REPLY_RECEIVED"`, aligned dashboard summary and funnel route filters. Redundant `apps/web` duplicate route and tests deleted. All 273 API unit tests passing (100%). |



