> ⚠️ **DEPRECATED (July 2026)** — This document is historical context only. The canonical active tracker is [`../OPEN_ITEMS.md`](../OPEN_ITEMS.md). The consolidated assessment lives at [`SYSTEM_READINESS_ASSESSMENT.md`](SYSTEM_READINESS_ASSESSMENT.md). Do not update this file.

# CraftMyFunnel Production Readiness Assessment

**Date:** 2026-05-29 — ARCHIVED
**Branch assessed:** `main`  
**Current main commit:** `5c68884` (`Merge CraftMyFunnel readiness updates`)  
**Working tree at assessment time:** clean  
**Assessment type:** evidence-based reassessment after CraftMyFunnel branding, hero redesign, worker hardening, health probes, Trivy gating, and readiness test additions.

## Overall Readiness Score

**81 / 100 - approaching production-ready, not yet launch-gate complete**

This is an improvement from the grounded 78/100 assessment because the following items are now complete and verified locally:

- Feature branch merged to `main`.
- Trivy Web image scan is blocking: `exit-code: '1'` and no `continue-on-error` on the Trivy step.
- Container health endpoint exists at `/api/health` with explicit liveness and readiness modes.
- Worker dispatch now dead-letters unknown and acknowledged-but-unimplemented job types instead of crashing.
- Unit tests verify health probe behavior and worker dead-letter behavior.
- Local unit suite passes: `7` test files, `28` tests.

The score is not higher because GitHub Actions still fail before any repository step runs. The downloaded Actions logs stop at hosted runner startup:

```text
Waiting for a runner to pick up this job...
Job is waiting for a hosted runner to come online.
```

No checkout, install, build, typecheck, Docker, Trivy, Playwright, or readiness-audit step executes in those failed runs. This is an infrastructure/executor blocker, not an application test failure, but production readiness cannot claim green CI until GitHub Actions or an equivalent CI runner executes successfully end to end.

## Scoring Breakdown

| Category | Score | Weight | Weighted | Verdict |
| --- | ---: | ---: | ---: | --- |
| Build & CI Pipeline | 82 | 20% | 16.4 | Strong config, CI execution blocked by hosted runner startup |
| Security & Auth | 80 | 20% | 16.0 | Hardened, but automated security coverage remains thin |
| Database & Data Layer | 85 | 15% | 12.8 | Solid schema and pgvector-ready data model |
| Worker / Background Jobs | 82 | 15% | 12.3 | Dead-letter and retry behavior improved; some handlers still not implemented |
| Test Coverage | 52 | 15% | 7.8 | Unit coverage improved, critical-path integration/E2E still missing |
| Observability & Ops | 82 | 10% | 8.2 | Health probes and structured logs improved; alerting still unverified |
| Documentation & Runbooks | 90 | 5% | 4.5 | Comprehensive but historical docs still contain stale readiness claims |
| **Total** |  | **100%** | **78.0 raw / 81 adjusted** | Improvement proven, launch gate still pending |

The adjusted score gives limited credit for work that directly closes previously listed top actions: merge to `main`, Trivy blocking, health probes, worker dead-letter behavior, and local unit evidence.

## Evidence Since Previous Assessment

### Completed

1. **Merged to `main`**
   - Main now contains the CraftMyFunnel brand sweep, hero redesign, workflow stabilization, health endpoint, worker hardening, and readiness tests.

2. **Trivy scan is blocking**
   - File: `.github/workflows/docker-ghcr.yml`
   - Web image Trivy step uses `exit-code: '1'`.
   - The Trivy step no longer has `continue-on-error`.
   - Note: the remaining `continue-on-error` in the Docker workflow applies to the optional Edge FastAPI image build, not to Trivy.

3. **Health-check endpoint for orchestrators**
   - File: `apps/web/src/app/api/health/route.ts`
   - Supported probes:
     - `GET /api/health?probe=live` returns a fast liveness response without database I/O.
     - `GET /api/health?probe=ready` checks database connectivity and returns `503` if the DB probe fails.
     - `GET /api/health` defaults to readiness in production and liveness outside production.

4. **Worker hardening**
   - File: `apps/web/src/workers/index.ts`
   - Known but unimplemented job types are explicitly acknowledged and dead-lettered.
   - Completely unknown job types are dead-lettered instead of crashing the worker loop.
   - Dispatch errors are caught and recorded through `JobQueue.fail`.

5. **Readiness tests added**
   - File: `apps/web/tests/unit/health-route.test.ts`
   - File: `apps/web/tests/unit/worker-dispatch.test.ts`
   - Verified locally with:

```bash
npm -w apps/web run test:unit -- --run
```

Result:

```text
Test Files  7 passed (7)
Tests       28 passed (28)
```

## Category Details

### 1. Build & CI Pipeline - 82/100

What is stronger now:

- `main` contains the readiness work.
- Trivy is configured to block on HIGH/CRITICAL Web image findings.
- CI workflows are YAML-parseable locally.
- PR workflows were pinned away from floating runner aliases.
- Unit checks pass locally.

Remaining gaps:

- GitHub Actions are not green end to end because hosted runners fail before any repository step starts.
- No successful current evidence for GitHub-hosted build, Docker smoke, Playwright, Vercel parity, Phi-3, or production gate runs.
- Windows local build remains unsuitable for production verification; Linux/Docker remains the intended build environment.

Current verdict: **CI configuration is stronger, but CI execution is externally blocked.**

### 2. Security & Auth - 80/100

What is stronger now:

- Trivy now blocks the Web image scan.
- Old ConvoSpan/Covospan branding references were removed from code, docs, scripts, logs, and filenames.
- Existing rate limiting, RBAC, audit logging, consent management, and security headers remain in place.
- Unit rate-limit tests are part of the passing unit suite.

Remaining gaps:

- Automated security regression coverage is still limited.
- No current OWASP ZAP or similar dynamic security scan is wired into a passing CI gate.
- CRM integration token fields should be verified against the encrypted-token pattern used by connected mailboxes.
- Login brute-force lockout and registration/invite-only behavior still need current-branch verification.

### 3. Database & Data Layer - 85/100

Strengths:

- Comprehensive Prisma schema with multi-tenant indexes.
- pgvector extension support.
- Event/audit models for operational traceability.
- Campaign, sequence, mailbox, landing, billing, and tracking models are present.

Remaining gaps:

- CI still uses `prisma db push` for ephemeral schemas.
- Migration-history discipline should be confirmed before production DB promotion.
- Vector columns remain `Unsupported` in Prisma, which is workable but reduces type safety.

### 4. Worker / Background Jobs - 82/100

What is stronger now:

- Worker no longer throws on unknown job types.
- Known unimplemented job types are explicitly dead-lettered.
- Dispatch-level failures are caught and recorded.
- Unit tests verify dead-letter behavior and implemented handler dispatch.
- `JobQueue.fail` already includes retry scheduling and dead-letter transition after max attempts.

Remaining gaps:

- Several acknowledged job types still do not have real handlers:
  - `workflow_step`
  - `WEBHOOK_DISPATCH`
  - `event_processing`
  - `linkedin_scraping`
  - `CSV_IMPORT`
  - `SEQUENCE_ACTION`
- Payloads still cross the dispatch boundary as `any`.
- Horizontal worker scaling semantics are not fully proven under concurrency.

### 5. Test Coverage - 52/100

What is stronger now:

- Unit tests are no longer near-zero.
- Current local unit result: `7` files, `28` tests passing.
- New tests cover:
  - health liveness without DB I/O
  - readiness success
  - readiness DB failure
  - worker dead-letter behavior
  - implemented handler dispatch

Remaining gaps:

- No passing current Playwright evidence.
- No current critical-path integration test proving lead -> campaign -> email -> tracking -> meeting.
- No API contract tests between `apps/web` route handlers and `apps/api`.
- No enforced coverage thresholds.

Current verdict: **Improved but still the largest production-readiness gap.**

### 6. Observability & Ops - 82/100

What is stronger now:

- `/api/health` now supports separate liveness and readiness semantics.
- Readiness probes can fail closed with `503` when DB connectivity is unavailable.
- Worker logs use structured logger calls.
- Queue stale-job reset uses structured logging.

Remaining gaps:

- GitHub-hosted CI cannot currently prove the production gate.
- Grafana dashboards and alert rules are referenced but not verified as live.
- PagerDuty/Slack alerting integration is not confirmed.
- Log aggregation pipeline is not confirmed.

### 7. Documentation & Runbooks - 90/100

Strengths:

- Deployment, rollback, monitoring, rate limiting, architecture, and setup documents exist.
- This dated readiness assessment now supersedes older aspirational readiness claims.

Remaining gaps:

- `PENDING_ITEMS.md`, `SYSTEM_STATUS.md`, and several historical summaries still include stale dates and aspirational scores.
- API documentation should be generated or aligned with the current Fastify/route-handler surface.

## Current Top Actions To Reach 85+

| Priority | Action | Impact | Notes |
| ---: | --- | --- | --- |
| 1 | Restore executable CI on GitHub or equivalent Linux runner | High | Current Actions fail before checkout; this blocks green-build evidence. |
| 2 | Add critical-path integration tests | High | Cover auth/session, lead import, campaign create, approved send, tracking event, and meeting workflow status. |
| 3 | Add API contract tests between `apps/web` and `apps/api` | Medium | Prevent adapter/route drift. |
| 4 | Implement real handlers or operational routing for acknowledged dead-letter job types | Medium | Dead-lettering is safe but not functionally complete. |
| 5 | Add security regression checks | Medium | Dependency scan is stronger now; still missing automated auth/security route assertions. |

## Launch Recommendation

Do not move to broad production traffic until:

1. CI executes successfully on `main` or an equivalent Linux runner.
2. Critical-path integration tests pass.
3. Playwright or a replacement smoke path proves the main revenue workflow.
4. Operational alerts are attached to health/readiness, worker dead-letter counts, and email-send failures.

Recommended gate remains **85+** before production traffic. Current score is **81/100** because meaningful hardening landed and is locally verified, but full production readiness still requires executable CI and broader end-to-end test evidence.
