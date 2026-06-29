# Production Launch Checklist

This checklist tracks the execution of verification scripts and manual gates required before declaring CraftMyFunnel production-ready.

## 1. Supabase Schema & Migration Proof
* [ ] Run tables shape check (`npm run readiness:check-db-shape`) against production database.
* [ ] Verify no column drift on `ConnectedMailbox` (status PASS).
* [ ] Run migration check (`npm run readiness:check-migration-status`) against production.
* [ ] Paste verification stdout results in `docs/audits/supabase-schema-migration-proof-results.md`.

## 2. Clerk User/Team Linkage
* [ ] Execute manual login testing flow using the designated `tester@craftmyfunnel.live` credentials.
* [ ] Verify database maps Clerk User ID successfully to a local `User` record.
* [ ] Verify local `User` record maps successfully to a `TeamMember` tenant record.
* [ ] Verify dashboard workspace routing returns `200 OK` (no auth-redirect loop or crash).

## 3. Redis/Cache Isolation
* [ ] Verify Redis preview namespace isolation setup.
* [ ] Verify caching metrics and connection bounds on active split runtime.

## 4. Google Cloud & Gmail OAuth
* [ ] Verify Gmail API scopes.
* [ ] Resolve PR #6 (Gmail business mail control) blocking changes.

## 5. Security & Verification Gates
* [ ] Complete Stage 12A security implementation and audit scanner run.
* [ ] Complete Stage 12B deep security hardening checklist.
