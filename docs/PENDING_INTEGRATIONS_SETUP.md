# Pending Integrations Setup

This runbook lists integrations that are still pending, partially configured, or environment-dependent after the Gmail mailbox work. It also states where each secret belongs for the current deployment shape:

- Supabase manages Postgres.
- Vercel hosts `apps/web`.
- `apps/api` runs the Fastify API/runtime.
- Google Cloud owns Gmail/Pub/Sub infrastructure.
- GitHub stores source and CI/deploy secrets only when Actions need them.

## Secret Placement Rule

Put a secret only where code runs that needs it.

- Supabase: database credentials and database-side config only.
- Vercel: frontend runtime variables and any server-side web routes deployed in `apps/web`.
- API/Fastify runtime: backend secrets used by `apps/api`, workers, OAuth callbacks, queues, billing, CRM, enrichment, and AI.
- Google Cloud: cloud infrastructure resources, IAM, OAuth client configuration, Pub/Sub, Scheduler.
- GitHub Actions: CI/migration/deploy secrets only. Do not duplicate production runtime secrets in GitHub unless a workflow directly uses them.

## Integration Status Summary

| Integration | Status | Primary Runtime | Required Before Launch |
| --- | --- | --- | --- |
| Supabase Postgres migration | Pending execution | Supabase + API migration runner | Yes |
| Gmail/Pub/Sub OIDC validation | Pending code hardening | API/Fastify + Google Cloud | Yes for production |
| Gmail watch renewal/fallback sync | Pending scheduled route/job | API/Fastify + Cloud Scheduler | Yes for reliable receiving |
| Gmail mailbox admin UI | Backend exists, UI minimal/missing | Vercel frontend + API | Recommended |
| Redis/queue backend | Optional but recommended | API/Fastify/worker | Recommended for scale |
| AI providers | Env-dependent | API/Fastify | Yes for AI drafts |
| Razorpay billing | Env-dependent | Web + API | If paid credits/billing are live |
| SMTP fallback/system mail | Env-dependent | Web + API | Recommended |
| CRM sync | Partial/env-dependent | API/Fastify | Optional |
| Hunter.io enrichment | Env-dependent | API/Fastify | Optional |
| WhatsApp Business API | Mock/default; production pending | API/Fastify | Optional |
| LinkedIn extension/runner | Optional/review-first | Web + API + local extension | Optional |
| Sentry/PostHog monitoring | Env-dependent | Web + API | Recommended |
| Edge/private runtime | Optional | Edge service + API | Optional |

## 1. Supabase Postgres Migration

Purpose: apply the new Gmail engagement tables and columns.

Secrets:

| Secret | Supabase | Vercel | API/Fastify | GitHub Actions |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Source value | Yes, if web uses Prisma | Yes | Only if CI/migrate uses DB |
| `DIRECT_URL` | Source value | Optional | Required for migration runner | Only if CI/migrate uses DB |

Steps:

1. Confirm Supabase pooler and direct URLs.
2. Set runtime `DATABASE_URL` to the pooler URL.
3. Use `DIRECT_URL` for migrations.
4. Run:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

5. Confirm these tables exist:

- `ConnectedMailbox`
- `EmailActivityLog`
- `EmailTrackedLink`
- `SuppressionEntry`
- `WaitlistRequest`

## 2. Gmail Pub/Sub OIDC Validation

Purpose: make Gmail inbound webhook production-grade.

Secrets/config:

| Value | Google Cloud | API/Fastify | Vercel | GitHub Actions |
| --- | --- | --- | --- | --- |
| Pub/Sub topic | Yes | `GMAIL_PUBSUB_TOPIC` | No | No |
| Push service account | Yes | Expected issuer/audience config if implemented | No | No |
| Static token fallback | No | `GMAIL_PUBSUB_WEBHOOK_TOKEN` local/beta only | No | No |

Steps:

1. Create `pubsub-push` service account.
2. Configure Pub/Sub push subscription with OIDC.
3. Grant Pub/Sub service agent `roles/iam.serviceAccountTokenCreator`.
4. Add API-side JWT verification for:
   - issuer: Google OIDC issuer
   - audience: `https://YOUR_API_DOMAIN/webhooks/gmail/pubsub`
   - service account email: `pubsub-push@YOUR_PROJECT_ID.iam.gserviceaccount.com`
5. Keep token fallback only for local/beta.

## 3. Gmail Watch Renewal and Fallback Sync

Purpose: Gmail `watch` expires and must be renewed. Pub/Sub delivery can also miss events, so history sync should run periodically.

Secrets/config:

| Secret | Google Cloud | API/Fastify | Vercel | GitHub Actions |
| --- | --- | --- | --- | --- |
| `CRON_SECRET` | Scheduler header/value | Yes | No | No |
| `GMAIL_PUBSUB_TOPIC` | Topic resource | Yes | No | No |

Steps:

1. Add an authenticated API route to renew mailbox watches.
2. Add an authenticated API route or job to enqueue fallback Gmail sync.
3. Create Cloud Scheduler jobs:
   - daily watch renewal
   - periodic fallback sync, for example every 15-60 minutes
4. Send `Authorization: Bearer $CRON_SECRET` from Scheduler.
5. Log `GMAIL_WATCH_RENEWED` and sync failures.

## 4. Gmail Mailbox Admin UI

Purpose: let admins connect, view, test, and troubleshoot Gmail mailboxes.

Secrets:

| Secret | API/Fastify | Vercel |
| --- | --- | --- |
| `GOOGLE_WORKSPACE_CLIENT_ID` | Yes | No |
| `GOOGLE_WORKSPACE_CLIENT_SECRET` | Yes | No |
| `GMAIL_OAUTH_REDIRECT_URI` | Yes | No |
| `NEXT_PUBLIC_API_URL` / `API_INTERNAL_ORIGIN` | API base | Web proxy/API calls |

Steps:

1. Add UI in admin/team settings to call `/admin/mailboxes`.
2. Add Connect Gmail button using `/admin/mailboxes/connect`.
3. Add Test Send action using `/admin/mailboxes/test-send`.
4. Show mailbox status, `lastSyncAt`, `watchExpiration`, and `lastError`.

## 5. Redis / Queue Backend

Purpose: improve worker reliability and distributed queue/cache behavior.

Secrets:

| Secret | API/Fastify | Vercel | GitHub Actions |
| --- | --- | --- | --- |
| `REDIS_URL` | Yes | Only if web server routes use Redis | Optional for tests |

Steps:

1. Provision Upstash Redis, Redis Cloud, or another managed Redis.
2. Set `REDIS_URL` in API runtime.
3. Set `REDIS_URL` in Vercel only if web routes use Redis directly.
4. Confirm app boots without Redis for non-queue flows.
5. Add monitoring for queue depth and failed jobs.

## 6. AI Providers

Purpose: AI drafting, reply classification, drip recommendations, enrichment summaries.

Secrets:

| Secret | API/Fastify | Vercel | GitHub Actions |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Yes | No | Optional for AI tests |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Yes | No | Optional |
| `GROQ_API_KEY` | Yes | No | Optional |
| `ANTHROPIC_API_KEY` | Yes | No | Optional |

Steps:

1. Set at least one primary provider key in API runtime.
2. Prefer two providers for fallback.
3. Verify AI guardrails and credit enforcement still route through `apps/api/src/lib/aiService.ts`.
4. Run a draft and reply-analysis smoke test.

## 7. Razorpay Billing

Purpose: credit top-ups, subscription checkout, billing portal/history.

Secrets:

| Secret | Vercel | API/Fastify | GitHub Actions |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Optional | No |
| `RAZORPAY_KEY_SECRET` | No | Yes | No |

Steps:

1. Create Razorpay key pair.
2. Put public key in Vercel.
3. Put secret key in API runtime.
4. Configure webhooks if billing fulfillment relies on Razorpay events.
5. Test checkout/top-up in sandbox before production keys.

## 8. SMTP Fallback / System Mail

Purpose: support contact forms, verification, alerts, and fallback delivery.

Secrets:

| Secret | API/Fastify | Vercel |
| --- | --- | --- |
| `SMTP_FROM_NAME` | Yes | Yes if web contact/support routes send mail |
| `SMTP_FROM_EMAIL` | Yes | Yes if web contact/support routes send mail |
| `SMTP_HOST` | Yes | Yes if web contact/support routes send mail |
| `SMTP_PORT` | Yes | Yes if web contact/support routes send mail |
| `SMTP_SECURE` | Yes | Yes if web contact/support routes send mail |
| `SMTP_USER` | Yes | Yes if web contact/support routes send mail |
| `SMTP_PASSWORD` | Yes | Yes if web contact/support routes send mail |
| `ENCRYPTION_KEY` | Yes | Only if web encrypts/decrypts stored SMTP credentials |

Steps:

1. Keep Gmail API as campaign sender.
2. Use SMTP only for system/fallback mail.
3. Set SMTP secrets in any runtime that sends SMTP directly.
4. Send contact/support form smoke test.

## 9. CRM Sync: HubSpot / Salesforce

Purpose: sync lead/account/opportunity data.

Secrets:

| Secret | API/Fastify | Vercel | GitHub Actions |
| --- | --- | --- | --- |
| `HUBSPOT_API_KEY` | Yes | No | Optional for integration tests |
| `SALESFORCE_CLIENT_ID` | Yes | No | Optional |
| `SALESFORCE_CLIENT_SECRET` | Yes | No | Optional |

Steps:

1. Decide which CRM is launch-critical.
2. Configure provider app/API credentials.
3. Put secrets in API runtime.
4. Test `/settings/crm` flows.
5. Verify tenant/team scoping before enabling sync.

## 10. Hunter.io Email Enrichment

Purpose: find and verify work emails for leads.

Secrets:

| Secret | API/Fastify | Vercel | GitHub Actions |
| --- | --- | --- | --- |
| `HUNTER_API_KEY` | Yes | No | Optional |

Steps:

1. Add Hunter API key to API runtime.
2. Test single email finder route.
3. Test domain search route if exposed.
4. Add rate/quota guardrails before bulk enrichment.

## 11. WhatsApp Business API

Purpose: consented WhatsApp follow-up and handoff workflows.

Secrets:

| Secret | API/Fastify | Vercel | GitHub Actions |
| --- | --- | --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Yes | No | No |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | No | No |
| `WHATSAPP_MOCK_MODE` | Yes | Optional display only | No |

Steps:

1. Keep `WHATSAPP_MOCK_MODE=true` until production Meta app is approved.
2. Configure Meta WhatsApp Business account and phone number.
3. Add production token and phone number ID to API runtime.
4. Confirm consent ledger before outbound messages.
5. Add webhook verification if receiving WhatsApp inbound messages.

## 12. LinkedIn Extension / Runner

Purpose: assisted LinkedIn tasks without risky cloud automation.

Secrets/config:

| Secret | API/Fastify | Vercel | Local Operator |
| --- | --- | --- | --- |
| `EXTENSION_API_KEY` | Yes | No | Extension popup/config |
| `BROWSER_WS_ENDPOINT` | Only if browser runner is enabled | No | Optional local browser node |

Steps:

1. Keep direct LinkedIn automation disabled for beta unless explicitly approved.
2. Use Chrome extension assisted mode.
3. Set `EXTENSION_API_KEY` in API runtime and extension config.
4. Avoid storing LinkedIn session cookies in shared cloud environments.

## 13. Monitoring: Sentry and PostHog

Purpose: error tracking and product analytics.

Secrets:

| Secret | API/Fastify | Vercel | GitHub Actions |
| --- | --- | --- | --- |
| `SENTRY_DSN` | Yes | Yes | Optional sourcemaps |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | Yes | No |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | Yes | No |

Steps:

1. Add Sentry DSN to API and web runtime if using Sentry.
2. Add PostHog public key/host to Vercel if product analytics are desired.
3. Avoid logging secrets, tokens, raw Gmail bodies, or private lead data.
4. Add alerts for Gmail sync failures and queue failures.

## 14. Edge / Private Runtime

Purpose: optional private edge runtime and browser/hardware-dependent features.

Secrets/config:

| Secret | API/Fastify | Edge Runtime | Vercel |
| --- | --- | --- | --- |
| `EDGE_NODE_URI` | Yes | Its public/private URL | No |
| `EDGE_NODE_OPTIONAL` | Yes | No | Optional display only |
| `HARDWARE_SIGNATURE` | API if validating edge | Edge if proving device | No |
| `STRICT_SOVEREIGNTY` | API | Edge policy | No |

Steps:

1. Keep `EDGE_NODE_OPTIONAL=true` until edge runtime is required by contract.
2. Deploy `apps/edge-fastapi` only for private runtime customers.
3. Configure secure tunnel/network path.
4. Verify health checks before enabling strict sovereignty.

## 15. GitHub Actions Secrets

Only add these if workflows use them:

| Workflow Need | GitHub Secret |
| --- | --- |
| Prisma migration deploy | `DATABASE_URL`, `DIRECT_URL` |
| Vercel deploy through Actions | Vercel token/project/org IDs |
| API deploy through Actions | provider deploy token and required runtime injection |
| Integration tests | test-only API keys, never production keys unless unavoidable |

Do not put Gmail OAuth client secret, LLM keys, billing keys, or production database credentials in GitHub unless a workflow directly needs them.

## Recommended Order

1. Supabase migration deploy.
2. Gmail Pub/Sub OIDC validation and watch renewal.
3. Gmail mailbox admin UI.
4. Redis/worker reliability.
5. AI provider production keys and guardrail smoke tests.
6. Monitoring with Sentry/PostHog.
7. Billing if payments are live.
8. CRM/enrichment integrations.
9. WhatsApp and LinkedIn optional channels.
10. Edge/private runtime only when contractually required.

