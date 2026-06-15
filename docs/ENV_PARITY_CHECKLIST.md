# Environment Parity Checklist

Use this file to keep Local, GitHub Actions, Railway/Vercel, Supabase, Clerk, Redis/Upstash, payment, email, WhatsApp, and AI provider configuration aligned.

## Classification

- A: Required for base app deploy
- B: Required for auth
- C: Required for database
- D: Required only when feature enabled
- E: Future or not implemented

## Base App

| Variable | Class | Notes |
| --- | --- | --- |
| `NODE_ENV=production` | A | Required for production runtime. |
| `NEXTAUTH_SECRET` | B | Required if NextAuth path is active. |
| `NEXTAUTH_URL` | B | Required if NextAuth path is active. |
| `CLERK_SECRET_KEY` | B | Required if Clerk path is active. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | B | Required if Clerk path is active. |

## Database

| Variable | Class | Notes |
| --- | --- | --- |
| `DATABASE_URL` | C | Supabase Postgres runtime URL. Use pooled connection when appropriate. |
| `DIRECT_URL` | C | Direct Supabase Postgres URL for migrations. |

Do not run destructive migration commands against production. Use `prisma migrate status`, `prisma migrate deploy`, and `prisma generate`.

## Cache And Queue

| Variable | Class | Notes |
| --- | --- | --- |
| `REDIS_URL` | D | Optional unless queue/cache features are enabled. |
| `UPSTASH_REDIS_REST_URL` | D | Optional Upstash path. |
| `UPSTASH_REDIS_REST_TOKEN` | D | Optional Upstash path. |

## Email And Google Workspace

| Variable | Class | Notes |
| --- | --- | --- |
| `SMTP_HOST` | D | Required only for SMTP send. |
| `SMTP_PORT` | D | Required only for SMTP send. |
| `SMTP_SECURE` | D | Required only for SMTP send. |
| `SMTP_USER` | D | Required only for SMTP send. |
| `SMTP_PASSWORD` | D | Required only for SMTP send. |
| `SMTP_FROM_NAME` | D | Required only for SMTP send. |
| `SMTP_FROM_EMAIL` | D | Required only for SMTP send. |
| `GOOGLE_CLIENT_ID` | D | Required only for Google Workspace OAuth. |
| `GOOGLE_CLIENT_SECRET` | D | Required only for Google Workspace OAuth. |

## WhatsApp

| Variable | Class | Notes |
| --- | --- | --- |
| `WHATSAPP_ENABLED` | D | Keep `false` until provider is selected and verified. |
| `WHATSAPP_ACCESS_TOKEN` | D | Appears intended for Meta Cloud API. |
| `WHATSAPP_PHONE_NUMBER_ID` | D | Appears intended for Meta Cloud API. |
| `WHATSAPP_API_TOKEN` | D | Appears provider-specific or inconsistent with Meta Cloud API naming. |
| `WHATSAPP_WABA_ID` | D | Appears provider-specific or inconsistent with send path naming. |

Follow-up required: choose one WhatsApp provider contract and normalize variable names. Do not remove existing code variables during smoke deployment unless provider ownership is confirmed.

## Billing

| Variable | Class | Notes |
| --- | --- | --- |
| `BILLING_ENABLED` | D | Keep `false` until test checkout and webhook are verified. |
| `RAZORPAY_KEY_ID` | D | Server-side billing key. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | D | Browser publishable key used by checkout UI. |
| `RAZORPAY_KEY_SECRET` | D | Server-side secret. |
| `RAZORPAY_WEBHOOK_SECRET` | D | Required for webhook verification. |

## AI Providers

| Variable | Class | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | D | Required only for Gemini generation. |
| `OPENAI_API_KEY` | D | Required only for OpenAI generation. |
| `ANTHROPIC_API_KEY` | D | Required only for Anthropic generation. |

AI calls should continue through the API service boundary so guardrails, billing, credit checks, and usage logging remain intact.

## Content Assets And Edge Runtime

| Variable | Class | Notes |
| --- | --- | --- |
| `CONTENT_ASSETS_ENABLED` | D | Keep `false` until service is live. |
| `CONTENT_ASSET_API_URL` | D | Required only when content asset generation is enabled. |
| `EDGE_RUNTIME_ENABLED` | D | Keep `false` unless private runtime is deployed and monitored. |
| `EDGE_NODE_URI` | D | Optional edge runtime endpoint. |
| `EDGE_NODE_URL` | D | Optional edge runtime endpoint alias. |
| `ON_PREM_AI_ENDPOINT` | D | Optional on-prem AI endpoint. |
| `EDGE_API_KEY` | D | Optional edge runtime credential. |

## Extension And CRM

| Variable | Class | Notes |
| --- | --- | --- |
| `EXTENSION_GATEWAY_ENABLED` | D | Keep `false` until Chrome extension sync is verified. |
| `EXTENSION_API_KEY` | D | Required only if extension gateway auth uses an API key. |
| `CRM_ENRICHMENT_ENABLED` | D | Keep `false` until provider credentials and tests exist. |
| `HUBSPOT_ACCESS_TOKEN` | D | Required only for HubSpot sync. |
| `SALESFORCE_CLIENT_ID` | D | Required only for Salesforce sync. |
| `SALESFORCE_CLIENT_SECRET` | D | Required only for Salesforce sync. |
| `PIPEDRIVE_API_TOKEN` | D | Required only for Pipedrive sync. |
| `APOLLO_API_KEY` | E | Future enrichment provider. |
| `PEOPLE_DATA_LABS_API_KEY` | E | Future enrichment provider. |
| `PROXYCURL_API_KEY` | E | Future enrichment provider. |
| `NETJANA_ENABLED` | E | Keep `false`; integration is planning or provider-gated. |
| `NETJANA_URL` | E | Future or provider-gated. |
| `NETJANA_HMAC_SECRET` | E | Future or provider-gated. |

## Environment Targets

Local:

- May use local Postgres and Redis.
- Optional providers can remain unset.

GitHub Actions:

- Provision Postgres and Redis only in workflows that need them.
- Do not require optional provider credentials for build-only workflows.

Railway or Vercel:

- Set build timeout to 30 minutes.
- Provide base, auth, and DB variables before smoke deployment.
- Keep optional feature flags disabled until provider smoke tests are ready.

Supabase:

- Confirm pooled runtime URL and direct migration URL.
- Confirm latest migration `20260614173000_add_llm_usage_actor`.

Clerk:

- Confirm production publishable key and secret key.
- Confirm callback URLs match production app URLs.
