# Gmail Cloud Setup for Campaign Mailboxes

This app uses Gmail as a connected business mailbox for campaign sending, reply ingestion, open/click tracking, unsubscribe suppression, and AI-prepared drip drafts.

## 2026 Implementation Posture

Use a reply-first and click-quality model for campaign intelligence:

- Treat inbound replies, reply sentiment, unsubscribe events, and safe link clicks as primary engagement signals.
- Treat open pixels as optional/noisy telemetry only. Apple Mail Privacy Protection, Gmail image caching, and image blocking make open rates unreliable for decisioning.
- Do not optimize drip logic primarily on open rate. Use opens as a weak supporting signal and prefer replies, clicks, suppressions, bounces/failures, and lead state changes.
- If click tracking is enabled, use a tracking domain that matches or is clearly aligned with the sender/from domain to reduce link-mismatch deliverability risk.
- Prefer authenticated Pub/Sub push with OIDC as the production default. Static webhook tokens are acceptable only for local development or short beta windows.
- Prefer Auth.js `AUTH_*` variables going forward. Keep `NEXTAUTH_*` aliases during the current NextAuth/Auth.js transition until the codebase is fully migrated.

## Required Google APIs

Enable these APIs in the Google Cloud project that owns the OAuth client:

- Gmail API
- Cloud Pub/Sub API
- IAM Service Account Credentials API, if using authenticated Pub/Sub push
- Cloud Logging API
- Cloud Monitoring API
- Cloud Scheduler API, recommended for daily Gmail watch renewal and fallback sync

## OAuth Consent and Scopes

Create an OAuth Web Client and configure these redirect URIs:

- Local: `http://localhost:3001/admin/mailboxes/callback`
- Production: `https://YOUR_API_DOMAIN/admin/mailboxes/callback`

Requested Gmail scopes:

```txt
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
```

Notes:

- `gmail.send` is sensitive.
- `gmail.readonly` is restricted and requires Google restricted-scope verification before broad production/customer use.
- Do not add `gmail.modify` unless the app needs to label, archive, or move Gmail messages.
- For internal-only Google Workspace usage, configure the consent screen as Internal where possible. For customers outside your Workspace, configure it as External and complete verification.

## Pub/Sub Resources

Create one topic for Gmail notifications:

```bash
gcloud pubsub topics create gmail-inbound
```

Grant Gmail permission to publish to that topic:

```bash
gcloud pubsub topics add-iam-policy-binding gmail-inbound \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

Create a push subscription to the API webhook with authenticated push for production. Static-token push is only a beta/local fallback.

Production authenticated push endpoint:

```bash
gcloud pubsub subscriptions create gmail-inbound-push \
  --topic=gmail-inbound \
  --push-endpoint="https://YOUR_API_DOMAIN/webhooks/gmail/pubsub" \
  --push-auth-service-account="pubsub-push@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --push-auth-token-audience="https://YOUR_API_DOMAIN/webhooks/gmail/pubsub"
```

Temporary beta/local shared-token fallback:

```bash
gcloud pubsub subscriptions create gmail-inbound-push \
  --topic=gmail-inbound \
  --push-endpoint="https://YOUR_API_DOMAIN/webhooks/gmail/pubsub?token=YOUR_GMAIL_PUBSUB_WEBHOOK_TOKEN"
```

The app currently supports a shared webhook token through `GMAIL_PUBSUB_WEBHOOK_TOKEN`. In production, use OIDC authenticated push and validate the bearer token audience/issuer in the API before removing the token fallback.

## Authenticated Push Setup

Create a push auth service account:

```bash
gcloud iam service-accounts create pubsub-push \
  --display-name="Pub/Sub Push Auth"
```

Create or update the subscription with OIDC auth:

```bash
gcloud pubsub subscriptions update gmail-inbound-push \
  --push-auth-service-account="pubsub-push@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --push-auth-token-audience="https://YOUR_API_DOMAIN/webhooks/gmail/pubsub"
```

Grant Pub/Sub service agent permission to mint OIDC tokens:

```bash
PROJECT_NUMBER="$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

If your operator/service account creates or updates the authenticated subscription, it also needs `iam.serviceAccounts.actAs` on the push auth service account, commonly via `roles/iam.serviceAccountUser`.

## IAM Summary

Setup operator needs:

- `roles/serviceusage.serviceUsageAdmin`, to enable APIs
- `roles/pubsub.admin`, to create topics/subscriptions
- `roles/iam.serviceAccountAdmin`, only if creating service accounts
- `roles/iam.serviceAccountUser`, if configuring authenticated push service accounts

Gmail publisher needs:

- Principal: `gmail-api-push@system.gserviceaccount.com`
- Role: `roles/pubsub.publisher`
- Resource: Gmail Pub/Sub topic only

Pub/Sub service agent needs for authenticated push:

- Principal: `service-PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com`
- Role: `roles/iam.serviceAccountTokenCreator`
- Resource: project or push auth service account

Runtime service account only needs Pub/Sub IAM if you later implement pull subscription processing:

- `roles/pubsub.subscriber` on the subscription

## App Environment Variables

Set these in the API runtime:

```env
GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=
GMAIL_OAUTH_REDIRECT_URI=https://YOUR_API_DOMAIN/admin/mailboxes/callback

GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-inbound
GMAIL_PUBSUB_WEBHOOK_TOKEN=

MAILBOX_TOKEN_ENCRYPTION_KEY=

NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN
API_URL=https://YOUR_API_DOMAIN
AUTH_URL=https://YOUR_WEB_DOMAIN
AUTH_SECRET=

# Transitional aliases while this repo still has NextAuth v4-compatible code paths.
NEXTAUTH_URL=https://YOUR_WEB_DOMAIN
NEXTAUTH_SECRET=same-as-AUTH_SECRET
```

`MAILBOX_TOKEN_ENCRYPTION_KEY` should be a stable secret. Use a 64-character hex value:

```bash
openssl rand -hex 32
```

## Deployment Secrets by Platform

This project currently uses Supabase for Postgres, Vercel for the frontend, GitHub for source/CI, and Google Cloud for Gmail/Pub/Sub infrastructure. Put secrets in the platform that actually runs the code needing them.

### Supabase

Supabase manages Postgres. It does not need Gmail OAuth secrets unless you later add Supabase Edge Functions for Gmail work.

Use Supabase to obtain:

```env
DATABASE_URL=postgresql://...supabase-pooler...
DIRECT_URL=postgresql://...supabase-direct...
```

Recommended usage:

- `DATABASE_URL`: Supabase transaction pooler for app runtime.
- `DIRECT_URL`: Supabase direct connection for Prisma migrations.

### Database Migration Required

Yes, Postgres changes are required for the Gmail engagement loop.

New tables:

- `ConnectedMailbox`
- `EmailActivityLog`
- `EmailTrackedLink`
- `SuppressionEntry`
- `WaitlistRequest`

New `Email` columns:

- `gmailThreadId`
- `trackingToken`
- `sentAt`

Run this against Supabase before using Gmail features:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Use the Supabase direct DB URL for migrations where possible. The pooler is better for runtime traffic.

### Vercel Frontend

For `apps/web` on Vercel, set:

```env
AUTH_URL=https://YOUR_FRONTEND_DOMAIN
AUTH_SECRET=same-long-secret-used-by-auth-runtime

# Transitional aliases until all auth code uses AUTH_* only.
NEXTAUTH_URL=https://YOUR_FRONTEND_DOMAIN
NEXTAUTH_SECRET=same-as-AUTH_SECRET

NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN
API_INTERNAL_ORIGIN=https://YOUR_API_DOMAIN
ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN

DATABASE_URL=postgresql://...supabase-pooler...
DIRECT_URL=postgresql://...supabase-direct...
PRISMA_CLIENT_ENGINE_TYPE=library
```

Frontend/public integrations can also live in Vercel when used by `apps/web`:

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

Do not put `GOOGLE_WORKSPACE_CLIENT_SECRET` in the frontend project unless the Gmail API routes are also executing server-side inside that same Vercel deployment.

### API Runtime

Wherever `apps/api` is deployed, set:

```env
DATABASE_URL=postgresql://...supabase-pooler...
DIRECT_URL=postgresql://...supabase-direct...
PRISMA_CLIENT_ENGINE_TYPE=library

AUTH_SECRET=same-as-web
AUTH_URL=https://YOUR_FRONTEND_DOMAIN

# Transitional aliases until all auth code uses AUTH_* only.
NEXTAUTH_SECRET=same-as-AUTH_SECRET
NEXTAUTH_URL=https://YOUR_FRONTEND_DOMAIN

NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN
API_URL=https://YOUR_API_DOMAIN
ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN

GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=
GMAIL_OAUTH_REDIRECT_URI=https://YOUR_API_DOMAIN/admin/mailboxes/callback
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-inbound
GMAIL_PUBSUB_WEBHOOK_TOKEN=

MAILBOX_TOKEN_ENCRYPTION_KEY=

OPENAI_API_KEY=
GOOGLE_API_KEY=
GROQ_API_KEY=
ANTHROPIC_API_KEY=

REDIS_URL=

SMTP_FROM_NAME=
SMTP_FROM_EMAIL=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASSWORD=
ENCRYPTION_KEY=

CRON_SECRET=
```

`MAILBOX_TOKEN_ENCRYPTION_KEY` must remain stable. If it changes, previously stored Gmail access and refresh tokens cannot be decrypted.

Prisma engine note:

- Use `PRISMA_CLIENT_ENGINE_TYPE=library` for Node.js runtimes.
- Use an Edge-compatible Prisma setup only if the API is actually deployed to an Edge runtime.
- For Supabase, use the appropriate pooler URL for runtime and the direct URL for migrations. If serverless connection churn becomes a bottleneck, evaluate Prisma Accelerate or another connection-management layer.

### Google Cloud / Antigravity

Google Cloud owns infrastructure configuration, not normal app runtime `.env` storage.

Configure in Google Cloud:

- Enable Gmail API.
- Enable Cloud Pub/Sub API.
- Create OAuth web client.
- Add OAuth redirect URI: `https://YOUR_API_DOMAIN/admin/mailboxes/callback`.
- Create Pub/Sub topic.
- Create Pub/Sub push subscription with OIDC authenticated push for production.
- Grant Gmail publisher IAM on the topic.

Values from Google Cloud that must be copied into the API runtime:

```env
GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-inbound
```

### GitHub

GitHub should normally hold source code, not production runtime secrets. Add secrets to GitHub only if GitHub Actions need them for CI, migrations, or deployment.

For a migration workflow:

```env
DATABASE_URL=
DIRECT_URL=
```

For Vercel deployments connected to GitHub, prefer storing runtime secrets in Vercel project settings instead of GitHub Actions.

### URL Alignment

Keep these values aligned across platforms:

```env
# Frontend / Vercel
NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN
API_INTERNAL_ORIGIN=https://YOUR_API_DOMAIN

# API runtime
AUTH_URL=https://YOUR_FRONTEND_DOMAIN
NEXTAUTH_URL=https://YOUR_FRONTEND_DOMAIN
NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN
API_URL=https://YOUR_API_DOMAIN
GMAIL_OAUTH_REDIRECT_URI=https://YOUR_API_DOMAIN/admin/mailboxes/callback
ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN
```

Google OAuth redirect URI:

```txt
https://YOUR_API_DOMAIN/admin/mailboxes/callback
```

Pub/Sub push endpoint:

```txt
https://YOUR_API_DOMAIN/webhooks/gmail/pubsub
```

Temporary beta/local token endpoint:

```txt
https://YOUR_API_DOMAIN/webhooks/gmail/pubsub?token=YOUR_GMAIL_PUBSUB_WEBHOOK_TOKEN
```

## Tracking and Deliverability Guidance

Open tracking:

- Keep pixel opens optional and low-trust.
- Do not trigger AI drip decisions from opens alone.
- Expect image caching, privacy prefetching, and image blocking to distort open rates.
- Consider disabling the tracking pixel for cold outbound until sender reputation is established.

Click tracking:

- Use HTTPS only.
- Use a tracking hostname aligned with the sender/from domain.
- Avoid generic/shared short-link domains.
- Preserve clear unsubscribe links and `List-Unsubscribe` headers.
- Track unique clicks, repeated clicks, destination URL, campaign, lead, and email ID through opaque tokens.

Reply-first intelligence:

- Use Gmail replies and `ReplyTracker` classifications as the strongest signal.
- Prioritize `INTERESTED`, `QUESTION`, `DNC`, `OOO`, and negative sentiment for next-step decisions.
- Treat unsubscribes and DNC replies as hard suppression signals.

## Auth.js and Next.js Compatibility

Target convention:

```env
AUTH_SECRET=
AUTH_URL=
```

Current transition:

- This repo still has NextAuth v4-compatible code paths and env reads.
- Set both `AUTH_*` and `NEXTAUTH_*` until the auth implementation is fully refactored.
- Keep `apps/web/src/proxy.ts` as the routing guard file for current Next.js proxy/middleware conventions.

Migration target:

- Refactor auth config to read `AUTH_SECRET`/`AUTH_URL` first.
- Keep `NEXTAUTH_SECRET`/`NEXTAUTH_URL` as fallback aliases for one release.
- Remove fallback aliases after production and preview deployments are confirmed.

## Restricted Scope Strategy

`gmail.readonly` is a restricted scope. For external B2B SaaS, plan for Google verification and a possible CASA/security assessment before broad production usage.

Recommended rollout:

- Stay in Internal mode for your own Google Workspace if this is only for your organization.
- Stay in Testing mode for beta users as long as practical.
- Keep scopes minimal: `gmail.send` + `gmail.readonly`.
- Avoid `gmail.modify` unless there is a verified product need.
- Document data minimization: store message IDs, thread IDs, derived classifications, snippets needed for workflow, and avoid retaining full mailbox contents unnecessarily.

## CSP and Procurement Readiness

For enterprise procurement, keep CSP explicit and narrow:

- Allow Google OAuth/account domains only where needed.
- Allow the API domain for app requests.
- Allow the tracking/click domain if different from the API domain.
- Avoid broad wildcard domains for scripts and frames in production.
- Keep `frame-ancestors 'none'`, `object-src 'none'`, and strict `base-uri`.

## Logs and Monitoring

Monitor these Google Cloud signals:

- Pub/Sub subscription `num_undelivered_messages`
- Pub/Sub push request error rate/non-2xx responses
- Gmail API 401/403 errors
- Gmail API quota errors
- OAuth verification/access errors
- IAM policy changes on the Pub/Sub topic and push service account

Monitor these app audit/activity events:

- `MAILBOX_CONNECTED`
- `GMAIL_WATCH_RENEWED`
- `GMAIL_REPLY_SYNCED`
- `SENT`
- `FAILED`
- `OPENED`
- `CLICKED`
- `REPLIED`
- `UNSUBSCRIBED`
- `AI_DRIP_DRAFT_CREATED`

## Validation Checklist

1. Admin opens `/admin/mailboxes/connect` and completes Gmail OAuth.
2. `ConnectedMailbox` row exists with encrypted tokens, `gmailHistoryId`, and `watchExpiration`.
3. `/admin/mailboxes/test-send` sends a test email and records `SENT`.
4. Reply to a sent campaign email.
5. Pub/Sub pushes to `/webhooks/gmail/pubsub`.
6. A `GMAIL_SYNC` job is queued and processed.
7. `ReplyTracker`, inbox `Message`, lead status, and `EmailActivityLog(REPLIED)` update.
8. Open and click tracking record `OPENED` and `CLICKED`.
9. Unsubscribe creates `SuppressionEntry` and blocks future sends.
10. `/campaigns/:id/drip/prepare` creates an approval-gated drip draft.
