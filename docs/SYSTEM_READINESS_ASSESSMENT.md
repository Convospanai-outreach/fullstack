# System Readiness Assessment & Audit Consolidation

> **Single Source of Truth**: All open items, audit findings, and production gaps are actively tracked in [`OPEN_ITEMS.md`](../OPEN_ITEMS.md). Legacy audit files (`HARDENING_IMPLEMENTATION_STATUS_*.md`, `PRODUCTION_READINESS_ASSESSMENT_*.md`, `repo-normalization-audit-*.md`) are historical context.

---

## Service & Architecture Boundaries

- **`apps/web`**: Next.js web application (UI, dashboard KPI routes, approval workflow).
- **`apps/api`**: Fastify API engine (Google Pub/Sub webhook endpoint, `INBOX_SYNC` worker, `gmail-history-sync-worker.ts`, transactional `EmailEvent` store).
- **`apps/edge-fastapi`**: Optional private edge runtime (monitored via status route with `required: false`).

---

## Active Audit Status Summary

Refer to [`OPEN_ITEMS.md`](../OPEN_ITEMS.md) for individual line items and verification evidence:

1. **OPEN-01: Multi-Tenant Data Isolation**: **Resolved** (`teamId` enforced across read/write/delete queries).
2. **OPEN-02: Remote GitHub Actions CI Execution**: **Resolved** (Run `#30352553274` completed green on remote repo).
3. **OPEN-03 & OPEN-04**: **Deferred** (External human actions: Google Cloud CASA assessment & Azure AD portal registration).
4. **OPEN-05: Live Gmail RFC 5322 Message-ID Reply Detection**: **In Progress** (Wiring complete in `apps/api`; awaiting live send → reply cycle on deployed environment).
5. **OPEN-06: Dashboard Stat Cards Database Backing**: **Resolved** (All 4 cards backed by real, `teamId`-scoped queries).
6. **OPEN-07: Accessibility Audit**: **Open** (Screen-reader audit pending for `/intel`, `/scraper-bridge`, `/jobs`).
7. **OPEN-08: Production Worker Process Monitoring**: **Open** (Docker/PM2 supervisor verification for background worker loops).
8. **OPEN-09: Single Source Gmail Sync Alignment**: **Resolved** (Unified onto `apps/api` OIDC-secured Pub/Sub pipeline).
9. **OPEN-10: Reply Event Type Alignment**: **Resolved** (Unified event type string to `"REPLY_RECEIVED"`).
