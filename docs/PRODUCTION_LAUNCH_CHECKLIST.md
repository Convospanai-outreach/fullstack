# Production Launch Checklist

This checklist tracks the execution of verification scripts and manual gates required before declaring CraftMyFunnel production-ready.

## 1. Supabase Schema & Migration Proof (PASS)
* [x] Run tables shape check (`npm run readiness:check-db-shape`) against production database.
* [x] Verify no column drift on `ConnectedMailbox` (status PASS).
* [x] Run migration check (`npm run readiness:check-migration-status`) against production.
* [x] Recorded verification stdout results in `docs/audits/supabase-schema-migration-proof-results.md`.

## 2. Clerk User/Team Linkage (NEEDS_EXECUTION)
* [ ] Execute manual login testing flow using designated test credentials.
* [ ] Verify database maps Clerk User ID successfully to a local `User` record.
* [ ] Verify local `User` record maps successfully to a `TeamMember` tenant record.
* [ ] Verify dashboard workspace routing returns `200 OK` (no auth-redirect loop or crash).
* [ ] Reference [Clerk linkage verification plan](file:///d:/Convo/fullstack/docs/audits/clerk-user-team-linkage-verification-plan.md).

## 3. Redis/Cache Isolation (NEEDS_EXECUTION)
* [ ] Verify Redis preview namespace isolation setup.
* [ ] Verify caching metrics and connection bounds on active split runtime.
* [ ] Reference [Google, Clerk, Gmail & Redis verification checklist](file:///d:/Convo/fullstack/docs/audits/google-clerk-gmail-execution-checklist.md).

## 4. Google Cloud & Gmail OAuth (NEEDS_MANUAL_VERIFICATION)
* [x] Verify DNS foundation configuration is complete (MX, SPF, DKIM, DMARC, TXT site verification).
* [ ] Verify Gmail API enabled, OAuth consent screen configured, and URIs aligned.
* [ ] Connect test Gmail account, verify refresh token storage, and execute controlled send test.
* [ ] Reference [Google, Clerk, Gmail & Redis verification checklist](file:///d:/Convo/fullstack/docs/audits/google-clerk-gmail-execution-checklist.md).
* [ ] Resolve PR #6 (Gmail business mail control) blocking changes.

## 5. Security & Verification Gates (NEEDS_EXECUTION)
* [x] Fix Trivy Web image vulnerability scan failure (axios, cross-spawn, nanoid, node-notifier overrides).
* [ ] Complete Stage 12A security implementation and audit scanner run.
* [ ] Complete Stage 12B deep security hardening checklist.
* [ ] Reference [Trivy scan remediation report](file:///d:/Convo/fullstack/docs/audits/trivy-web-scan-remediation.md).
