# Agent Swarm Critique Report (2026-04-24)

## Swarm Setup

- User-simulation agent: UI/UX + backend flow walk-through per module.
- Review/audit agent: architecture, reliability, CI/testing, observability.
- Adversarial agent: abuse paths, authz bypass, prompt abuse, credit abuse.

## Scope And Method

- Code-path review across `apps/web` and `apps/api`.
- Targeted tests for queue-auth and RAG scoping.
- Cross-check against architecture + guardrail docs.

## Quick Verdict

- Current ship-readiness (consolidated): **4/10**
- Main blockers:
  1. Missing/weak RBAC on high-impact routes.
  2. Non-atomic credit enforcement under concurrency.
  3. UI/API contract drift in inbox and dashboard surfaces.
  4. Stored-XSS risk in published landing rendering.
  5. Reliability/observability gaps (limited metrics use, fragile test execution).

## Module Health Matrix

| Module | Status | Notes |
| --- | --- | --- |
| Onboarding/setup | Partial | Setup is richer; onboarding choices are not persisted. |
| Campaigns | Fail | Route-level authz and edit contract issues. |
| Leads | Fail | Raw id access/update without explicit team scoping. |
| Inbox/reply/suggest | Fail | Frontend reply endpoint mismatch with backend contract. |
| Email compose/send | Partial | Guardrails exist; no full E2E proof in this run. |
| Landing pages | Partial | Functional path present, but stored-XSS risk is high. |
| Intel/Netjana | Partial | Wiring exists; no full ingest-to-outreach E2E in this run. |
| AI helper/chat/preview/improve/execute | Partial | Guardrails present; embeddings path appears unmetered/unlogged. |
| Queue/extension | Partial | Auth/team scope improved; claim/idempotency gaps remain. |

## Consolidated Findings (Severity Ordered)

### Critical

1. **High-impact route authz/RBAC gaps**
   - Team member deletion route only checks same-team membership:
     - `apps/api/routes/team/[id]/route.ts`
   - Campaign/lead id routes mutate/read by raw id without explicit context enforcement:
     - `apps/api/routes/campaigns/[id]/route.ts`
     - `apps/api/routes/leads/[id]/route.ts`
   - Key/config/policy routes rely on `teamId` presence but lack explicit admin permission checks:
     - `apps/api/routes/settings/keys/[id]/route.ts`
     - `apps/api/routes/settings/guardrails/route.ts`
     - `apps/api/routes/team/policy/route.ts`

2. **Stored XSS risk in landing publishing/rendering path**
   - Published renderer injects HTML via `dangerouslySetInnerHTML`:
     - `apps/web/src/components/landing-agent/PublishedLandingRenderer.tsx`
   - Sanitization approach should be hardened before broad public usage.

### High

3. **Credit enforcement is not concurrency-safe**
   - `checkCredits()` preflight and later `deductCredits()` can race under parallel requests:
     - `apps/api/src/lib/aiService.ts`
     - `apps/api/src/lib/credits.ts`

4. **Inbox UI/API contract drift**
   - Frontend sends to `/inbox/${threadId}/send`, backend route is `/inbox/reply`:
     - `apps/web/src/app/(dashboard)/inbox/page.tsx`
     - `apps/api/routes/inbox/reply/route.ts`

5. **Potential secret/config overexposure**
   - Setup/status returns `aiConfig` with partial redaction strategy:
     - `apps/api/routes/setup/status/route.ts`
   - SMTP config route is team-authenticated but lacks explicit admin gating:
     - `apps/api/routes/smtp/config/route.ts`

6. **Legacy queue semantics can permit duplicate/ambiguous completion**
   - Pending/result flow lacks explicit lease/claim token and idempotent completion guard:
     - `apps/api/routes/queue/pending/route.ts`
     - `apps/api/routes/queue/result/route.ts`

### Medium

7. **Unmetered/unlogged embeddings path**
   - `getEmbeddings()` path appears outside main usage/billing logging contract:
     - `apps/api/src/lib/aiService.ts`
     - `apps/api/routes/ai/execute/route.ts`

8. **Dashboard API base inconsistency**
   - Several pages use raw `NEXT_PUBLIC_API_URL` rather than resilient proxy fallback:
     - `apps/web/src/app/(dashboard)/campaigns/page.tsx`
     - `apps/web/src/app/(dashboard)/leads/[id]/page.tsx`
     - `apps/web/src/app/(dashboard)/inbox/page.tsx`

9. **Observability depth is limited on critical paths**
   - Metrics route exists, but instrumentation coverage appears sparse on AI/queue hot paths.

## Adversarial Scenarios (Most Plausible)

1. Member-level sabotage of team configuration, guardrails, keys, or membership.
2. Prompt/context poisoning through lead/memory/asset text to influence generation.
3. Queue result poisoning/replay without strict claim tokening.
4. Public endpoint flooding (landing lead/event + contact/support) without strong app-layer throttles.
5. Stored XSS through landing HTML supply chain into public render surface.

## Test And Execution Evidence

- Targeted tests run:
  - `apps/api/routes/queue/__tests__/legacy-queue-auth.test.ts`
  - `apps/api/src/modules/agent/core/__tests__/AgentExecutor.ragScope.test.ts`
- Result:
  - Passed with elevated timeout and local temp override (`TEMP`/`TMP` to repo tmp path).
  - Initial run failed with Windows temp `EPERM` in this environment.

## Prioritized Remediation Plan

### Stage 0 (This Week)

1. Add explicit RBAC guards (`admin/owner`) on secrets, team management, policy, and key routes.
2. Fix inbox frontend endpoint mismatch (`/inbox/reply` vs `/inbox/:id/send`) and add compatibility alias if needed.
3. Disable or harden raw landing HTML rendering path (trusted sanitizer + strict allowlist).
4. Move credits to atomic reservation/decrement semantics for AI calls.

### Stage 1 (1-2 Weeks)

1. Add claim token + idempotent completion semantics to queue pending/result.
2. Redact `aiConfig` output in setup/status to non-sensitive fields only.
3. Enforce consistent API base fallback pattern in all dashboard clients.
4. Bring embeddings path under guardrails + usage logging + credit policy (or disable temporarily).

### Stage 2 (2-4 Weeks)

1. Add authz regression tests for all privileged routes.
2. Add adversarial tests for prompt injection and context poisoning paths.
3. Add E2E flows for inbox reply, campaign edit, setup save/load, and public landing safety checks.
4. Add practical metrics on AI/queue success-failure-rate, latency, rejection/guardrail counts.

## Confidence And Limits

- Confidence: **high** for route-level authz and contract findings, **medium** for runtime abuse likelihood where full production config (WAF/CDN/rate limit infra) was not validated.
- This report is code-and-targeted-test based, not a full live environment penetration test.
