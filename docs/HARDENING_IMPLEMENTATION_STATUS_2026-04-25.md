> ⚠️ **DEPRECATED (July 2026)** — This document is historical context only. The canonical active tracker is [`../OPEN_ITEMS.md`](../OPEN_ITEMS.md). The consolidated assessment lives at [`SYSTEM_READINESS_ASSESSMENT.md`](SYSTEM_READINESS_ASSESSMENT.md). Do not update this file.

# Hardening Implementation Status (2026-04-25) — ARCHIVED

## What Was Implemented

- RBAC and tenant scoping were added or tightened on high-risk routes:
  - `apps/api/routes/campaigns/[id]/route.ts`
  - `apps/api/routes/leads/[id]/route.ts`
  - `apps/api/routes/settings/keys/[id]/route.ts`
  - `apps/api/routes/settings/guardrails/route.ts`
  - `apps/api/routes/team/policy/route.ts`
  - `apps/api/routes/smtp/config/route.ts`
  - `apps/api/routes/team/[id]/route.ts`
  - `apps/api/routes/setup/status/route.ts`
  - `apps/api/routes/setup/email/route.ts`
  - `apps/api/routes/setup/save/route.ts`
  - `apps/api/routes/settings/branding/route.ts`

- Credit enforcement was hardened:
  - `apps/api/src/lib/credits.ts` now uses atomic conditional decrement logic.
  - `apps/api/src/lib/aiService.ts` now reserves and settles credits around AI usage.
  - Embeddings are now validated, logged, and charged through the guarded AI path.
  - `apps/api/routes/ai/execute/route.ts` now validates embedding input.

- Landing page XSS exposure was reduced:
  - `apps/web/src/modules/landing-agent/rendering.ts` now sanitizes stored HTML through a tag/attribute allowlist before rendering.
  - `apps/api/src/modules/landing-agent/service.ts` strips more dangerous HTML/script/style/embed payloads on save.

- Queue claim/idempotency behavior was improved:
  - `apps/api/routes/queue/pending/route.ts`
  - `apps/api/routes/queue/result/route.ts`
  - `apps/api/routes/queue/__tests__/legacy-queue-auth.test.ts`

- Frontend/backend contract fixes were applied on critical UI paths:
  - `apps/web/src/app/(dashboard)/inbox/page.tsx`
  - `apps/web/src/app/(dashboard)/campaigns/page.tsx`
  - `apps/web/src/app/(dashboard)/leads/[id]/page.tsx`
  - `apps/web/src/app/(dashboard)/command-center/page.tsx`
  - `apps/web/src/lib/api/campaigns.ts`
  - `apps/web/src/lib/api/leads.ts`

## Verification

- `npm run typecheck --workspace apps/api` passed.
- `npm run typecheck --workspace apps/web` passed.
- Focused tests passed:
  - `apps/api/routes/queue/__tests__/legacy-queue-auth.test.ts`
  - `apps/api/src/modules/agent/core/__tests__/AgentExecutor.ragScope.test.ts`

## Remaining Follow-Up

- Add route-level tests for the new RBAC and team-scoping behavior.
- Add billing tests for reservation/settlement under concurrent AI requests.
- Add landing sanitizer behavior tests with representative hostile payloads.
- Add more queue behavior tests for duplicate-result and stale-claim scenarios.
