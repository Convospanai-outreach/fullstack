# Persistent Open-Items Ledger

**Last Reconciled:** 2026-07-27

---

## Open & Resolved Items

| ID | Item | Category | Status | Details / Evidence Requirement |
|----|------|----------|--------|--------------------------------|
| **OPEN-01** | Multi-Tenant Data Isolation | Security | **Resolved** | Verified write (`updateMany`), read (`findFirst`), and delete (`deleteMany`) paths enforce `teamId` scoping. Live test `scripts/test-tenant-isolation.mjs` confirmed Team A update/read/delete on Team B lead returns 0 rows modified. `getCurrentContext()` derives `teamId` from server-verified Clerk/NextAuth JWT; `convo-workspace-id` cookie is membership-validated before use. |
| **OPEN-02** | Remote GitHub Actions CI Execution | CI/CD | **Still Open** | Awaiting actual GitHub Actions job log/URL for pushed commit `3044f5a`. |
| **OPEN-03** | Google OAuth CASA Assessment | Compliance | **Deferred** | Human action required in Google Cloud Console / CASA portal. |
| **OPEN-04** | Azure AD App Registration (Microsoft OAuth) | Integrations | **Deferred** | Human action required in Azure Portal. |
| **OPEN-05** | Live Gmail RFC 5322 Message-ID Reply Detection | Verification | **Still Open** | Empirical live send → reply cycle test needed. Code-level wiring is correct in both `apps/web` (post-send wire header fetch) and `apps/api` (full `In-Reply-To`/`References` matching in `createInboundCampaignEvent`). Needs one live cycle to confirm Gmail preserves the wire Message-ID. |
| **OPEN-06** | Dashboard Stat Cards Database Backing | Audit | **Resolved** | All four primary stat cards use real `teamId`-scoped Prisma queries — no hardcoded fakes. Evidence: `prisma.meeting.count({ where: { teamId } })` (Meetings), `prisma.lead.count({ where: { teamId, status: { notIn: [...] } } })` (Active Pipeline), `prisma.email.count({ where: { lead: { teamId }, status: { in: ["draft","DRAFT_READY","queued"] } } })` (Drafts), `prisma.emailEvent.count({ where: { teamId, type: { in: ["OPENED","CLICKED","REPLIED","REPLY_RECEIVED"] } } })` (Signal Capture). Minor: `meetingsDelta` and `openRateDelta` hardcoded to `0` (no trend calculation) — cosmetic, not a data integrity issue. Source: [`apps/web/src/app/api/dashboard/summary/route.ts`](file:///d:/Convo/gmail-mail-outreach/apps/web/src/app/api/dashboard/summary/route.ts). |
| **OPEN-07** | Accessibility Page Audit | UX/QA | **Still Open** | Screen-reader testing required for `/intel`, `/scraper-bridge`, `/jobs`. |
| **OPEN-08** | Production Worker Process Monitoring | Operations | **Still Open** | Docker/PM2 process supervisor confirmation for background worker loops. |
| **OPEN-09** | Gmail PubSub / History Inbound Reply Processing Engine | Architecture | **Resolved** | Complete pipeline implemented in both `apps/web` and `apps/api`. `syncGmailInboundReplies()` fetches Gmail `history.list({ startHistoryId })` for `messagesAdded`, inspects message headers (`From`, `In-Reply-To`, `References`), filters outbound emails, matches `providerId`/`threadId` against `Email`, creates `REPLY_RECEIVED` or `BOUNCE` `EmailEvent`, creates inbound `Message` record, advances `Lead.status` to `REPLIED` or `STOPPED`, updates `Email` status, and increments `ConnectedMailbox.replyCount`/`bounceCount`. Covered by unit test `tests/unit/gmailHistorySync.test.ts` (2/2 passing). |
