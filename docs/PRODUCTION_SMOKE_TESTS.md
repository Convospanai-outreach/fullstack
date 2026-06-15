# Production Smoke Tests

Use this checklist after the first production smoke deployment. These checks should verify controlled behavior, not full commercial launch readiness.

## Basic App

Run these from a terminal and record status codes:

```bash
curl -I https://YOUR_APP_DOMAIN/
curl -I https://YOUR_APP_DOMAIN/login
curl -I https://YOUR_APP_DOMAIN/signup
curl -I https://YOUR_APP_DOMAIN/dashboard
curl -i https://YOUR_APP_DOMAIN/api/health
curl -i https://YOUR_APP_DOMAIN/api/dashboard/funnel
```

Expected:

- Public pages return `200` or a valid redirect.
- Authenticated pages return a valid redirect or controlled unauthorized response.
- API routes return `200`, `401`, `403`, or controlled setup-required responses.
- No route should return an unexpected `500` for missing optional provider credentials.

## Auth

Verify in production:

- Clerk signup page loads.
- Clerk login page loads.
- A new user can sign up.
- An existing user can log in.
- Workspace or team selection works.
- Super-admin access works only for approved super-admin users.

## Database

Verify:

- Deployed app connects to Supabase Postgres.
- `GET /api/health?probe=ready` reports database readiness when DB envs are configured.
- DB-backed dashboard APIs return controlled `200`, `401`, or `403`, not unexpected `500`.
- Migrations are applied.
- Migration `20260614173000_add_llm_usage_actor` is applied.
- `LLMUsageLog.actorId` exists.

## Lead Journey

Verify with a test workspace:

- Create a lead.
- Create a campaign.
- If an email provider is configured, send one test email.
- Confirm an `Email` row is created.
- Confirm an `EmailEvent` row is created when an event is received or simulated.
- Confirm lead status or `pipelineState` updates.
- Confirm dashboard funnel metrics update after the change.

## External Providers

Run only when the provider is explicitly enabled and credentials are configured:

- Redis or Upstash ping.
- SMTP or Google Workspace send smoke test.
- Razorpay test checkout and webhook verification.
- WhatsApp provider webhook verification.
- AI provider test generation and credit deduction.
- Chrome extension sync ping.
- Content asset service ping.
- NetJana route and credential verification.

## Disabled Integrations

When optional integrations are disabled or missing credentials:

- UI shows setup-required or disabled state.
- API returns controlled `400`, `401`, `403`, `404`, or `503` responses as appropriate.
- The app does not crash.
- Build does not fail.

Recommended disabled defaults:

```bash
WHATSAPP_ENABLED=false
BILLING_ENABLED=false
NETJANA_ENABLED=false
EDGE_RUNTIME_ENABLED=false
CONTENT_ASSETS_ENABLED=false
EXTENSION_GATEWAY_ENABLED=false
CRM_ENRICHMENT_ENABLED=false
```
