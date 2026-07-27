# Persistent Open-Items Ledger

**Last Reconciled:** 2026-07-27

---

## Open & Resolved Items

| ID | Item | Category | Status | Details / Evidence Requirement |
|----|------|----------|--------|--------------------------------|
| **OPEN-01** | Multi-Tenant Data Isolation | Security | **Resolved** | Verified write, read, and delete paths force `teamId` scoping at DB query level (`updateMany({ where: { id, teamId } })`). Executed live test script `scripts/test-tenant-isolation.mjs` against PostgreSQL: Team A update/read/delete on Team B lead returned 0 records updated/deleted. |
| **OPEN-02** | Remote GitHub Actions CI Execution | CI/CD | **Still Open** | Awaiting actual GitHub Actions job log/URL for commit `01327e1` / `01327e1` to verify remote build pass. |
| **OPEN-03** | Google OAuth CASA Assessment | Compliance | **External Action** | Human action required in Google Cloud Console / CASA portal. |
| **OPEN-04** | Azure AD App Registration (Microsoft OAuth) | Integrations | **External Action** | Human action required in Azure Portal. |
| **OPEN-05** | Live Gmail RFC 5322 Message-ID Reply Detection | Verification | **Still Open** | Empirical live send -> reply cycle test needed to confirm Gmail API (`messages.get?format=raw`) preserves custom wire Message-ID headers on replies compared to `Email.providerId`. |
| **OPEN-06** | Dashboard Stat Cards Database Backing | Audit | **Still Open** | Confirm live queries (no fallback/fake stats) for *Meetings Secured*, *Active Pipeline*, *Drafts Queued*, and *Signal Capture*. |
| **OPEN-07** | Accessibility Page Audit | UX/QA | **Still Open** | Complete accessibility testing for `/intel`, `/scraper-bridge`, and `/jobs`. |
| **OPEN-08** | Production Worker Process Monitoring | Operations | **Still Open** | PM2 / Docker container process supervisor confirmation for background worker loops (`campaign-execution-worker.ts`, `email-sending-worker.ts`). |
