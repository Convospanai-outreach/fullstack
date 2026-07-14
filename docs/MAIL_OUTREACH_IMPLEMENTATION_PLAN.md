# Mail Outreach Module Implementation Plan

Branch: `mail-outreach`
Base: current `main`

## Goal

Deliver a production-ready Gmail outreach module without importing the incompatible schema and unrelated changes from PR #6.

The implementation must use the current `main` database model as the canonical source of truth and must not create duplicate mailbox, tracking, or event models.

## Definition of done

A team administrator can connect a Google Workspace mailbox, securely send campaign email, track engagement, suppress unsubscribed recipients, ingest replies, monitor mailbox health, and disconnect the mailbox. All critical flows are covered by automated tests and pass staging acceptance checks.

## Non-negotiable architecture decisions

1. Current `main` Prisma schema is canonical.
2. Use existing `ConnectedMailbox`, `Email`, `EmailEvent`, `TrackedLink`, `SuppressionEntry`, `MailboxHealthSnapshot`, and `MailboxSyncCursor` concepts.
3. Do not recreate PR #6 models such as competing `EmailActivityLog` or `EmailTrackedLink` tables.
4. Choose one migration owner. Prefer `apps/api/prisma` for runtime database migrations; web must consume the same generated contract or synchronized schema without independently applying migrations.
5. Gmail secrets and tokens remain server-side and encrypted at rest.
6. Every send operation requires an idempotency key and atomic quota enforcement.
7. Preview and staging must never use production Gmail credentials, database, Redis, or Pub/Sub resources.

## Delivery phases

### Phase 1 — Schema alignment and service foundation

- Document the canonical mailbox and email model from `main`.
- Decide the single Prisma migration owner.
- Add only genuinely missing fields through an additive migration.
- Add environment validation for Gmail configuration.
- Add token encryption with versioned payloads and key validation.
- Add repository/service interfaces for mailbox reads and writes.

Exit criteria:

- Prisma format and validation pass.
- Migration applies to a clean local database and a main-shaped test database.
- No duplicate mailbox, tracking, suppression, or activity tables exist.
- Unit tests cover encryption and environment validation.

### Phase 2 — Gmail OAuth and mailbox lifecycle

- Admin-only mailbox connect endpoint.
- Signed OAuth state with timestamp, nonce, TTL, and replay prevention.
- OAuth callback with fresh team-membership validation.
- Store encrypted tokens and expiry.
- Persist refreshed tokens.
- Start Gmail watch after successful connection when Pub/Sub is configured.
- Add list, status, reconnect, disconnect, and revoke flows.
- Record audit events for lifecycle changes.

Exit criteria:

- Tampered, expired, and replayed state is rejected.
- User from team A cannot manage team B mailbox.
- Tokens never appear in API responses or logs.
- Disconnect revokes Google access and disables future sends.

### Phase 3 — Safe outbound sending

- Build a Gmail send adapter behind a provider interface.
- Support plain text and sanitized HTML.
- Generate proper RFC message headers.
- Store provider message ID, thread ID, send timestamp, and mailbox relation.
- Add idempotency per campaign, recipient, and sequence step.
- Enforce mailbox daily limits, warmup rules, and atomic counters.
- Retry transient Gmail errors with bounded exponential backoff.
- Mark revoked or unhealthy mailboxes appropriately.

Exit criteria:

- A retry cannot create a duplicate Gmail send.
- Suppressed recipients are blocked before provider invocation.
- Quota limits are enforced atomically.
- Unit and integration tests cover success, retry, quota, revoked token, and duplicate-job scenarios.

### Phase 4 — Tracking, unsubscribe, and suppression

- Reuse existing `EmailEvent` and `TrackedLink` models.
- Add opaque tracking tokens.
- Implement open pixel with safe metadata retention.
- Implement click redirect with URL validation and private-network protection.
- Implement one-click unsubscribe and suppression.
- Add List-Unsubscribe headers to outbound mail.
- Make tracking and suppression writes idempotent.

Exit criteria:

- Invalid tokens fail safely.
- Unsafe redirect destinations are blocked.
- Unsubscribe immediately prevents later sends.
- Tests cover open, click, unsubscribe, repeated requests, and cross-tenant isolation.

### Phase 5 — Pub/Sub, inbound replies, and watch renewal

- Configure Gmail watch using a staging/production-specific Pub/Sub topic.
- Verify Google Pub/Sub OIDC bearer tokens in production.
- Decode and validate Pub/Sub payloads.
- Enqueue one idempotent Gmail sync job per mailbox/history notification.
- Use `MailboxSyncCursor` for incremental history processing.
- Associate replies using Gmail thread IDs and RFC headers.
- Handle expired history cursors with a controlled resync.
- Add scheduled watch renewal before expiration.
- Add bounce and delivery-failure classification where Gmail messages provide evidence.

Exit criteria:

- Forged Pub/Sub requests are rejected.
- Duplicate notifications do not duplicate reply events.
- Reply association works for real staging conversations.
- Watches renew automatically and generate alerts on failure.

### Phase 6 — Product UI and operations

- Add mailbox connection settings for administrators.
- Show connected address, status, token health, watch expiry, last sync, send counts, and last error.
- Add reconnect and disconnect actions.
- Add campaign mailbox selection where multiple mailboxes are permitted.
- Add observability for sends, failures, sync lag, Pub/Sub errors, quota usage, and watch expiration.
- Add an internal health endpoint that checks Gmail configuration and mailbox worker readiness without exposing secrets.

Exit criteria:

- Admin can complete the full mailbox lifecycle from the UI.
- Operational failures are visible and actionable.
- Support has a documented runbook.

### Phase 7 — Staging and production acceptance

Required automated and staging tests:

1. Connect a Google Workspace mailbox.
2. Reject tampered, expired, and replayed OAuth state.
3. Encrypt tokens at rest.
4. Refresh and persist an expired access token.
5. Send plain-text and sanitized HTML email.
6. Preserve provider IDs, Gmail thread IDs, and RFC headers.
7. Enforce idempotency and mailbox quotas.
8. Record open and safe click events.
9. Process unsubscribe and block suppressed recipients.
10. Verify Pub/Sub OIDC and reject forged pushes.
11. Incrementally fetch Gmail history.
12. Detect and associate a reply.
13. Renew an expiring Gmail watch.
14. Handle revoked access and Gmail rate limits.
15. Prevent cross-team mailbox access.

Production release gates:

- Node 22.12+ CI passes.
- Prisma format, validate, migration status, and main-shaped migration dry run pass.
- Web and API typecheck, lint, tests, and builds pass.
- Vercel/API staging uses non-production DB, Clerk, Redis, Google OAuth, and Pub/Sub resources.
- No critical or high security findings remain.
- Rollback and mailbox-token recovery procedures are documented.

## Recommended commit sequence

1. `docs(mail): lock canonical architecture and acceptance criteria`
2. `feat(mail): align canonical mailbox schema and migration ownership`
3. `feat(mail): add encrypted Gmail OAuth mailbox lifecycle`
4. `feat(mail): add idempotent Gmail sending and quota controls`
5. `feat(mail): add tracking unsubscribe and suppression`
6. `feat(mail): add Pub/Sub reply sync and watch renewal`
7. `feat(mail): add mailbox admin UI and observability`
8. `test(mail): complete acceptance and staging coverage`
9. `docs(mail): add deployment and operations runbook`

## Work explicitly excluded from this branch

- Unrelated signup, Clerk, NextAuth, marketing-page, waitlist, extension, or general UI rewrites.
- New provider support such as Outlook.
- Destructive renaming of current mailbox tables in the first release.
- Applying migrations directly to production before a main-shaped staging dry run.

## Immediate engineering tasks

1. Inspect current `main` mailbox models and produce a canonical field map.
2. Remove duplicate migration ownership between web and API.
3. Create focused unit-test scaffolding for mail services.
4. Implement the additive schema migration, if any fields are truly missing.
5. Implement OAuth lifecycle before carrying over sending or tracking code from the closed PR.
