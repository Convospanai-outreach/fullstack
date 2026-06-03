# CraftMyFunnel Production Improvement Plan

**Date:** 2026-06-02  
**Goal:** move the full product from the current evidence-based state to a true **100/100 production readiness standard**

---

## Current State

As of this reassessment:

- `apps/api` readiness audit: **100/100**
- local overall product readiness: about **96/100**

The biggest remaining gaps are:

- unconfirmed green GitHub Actions runs after the latest local fixes
- incomplete Docker/build proof on this Windows host
- residual upstream moderate dependency advisories that need formal acceptance
- documentation and process drift risk

---

## What 100/100 Means

To call the platform a real **100/100**, all of these must be true at the same time:

1. local critical checks pass reliably
2. GitHub Actions are green on the target branch and on `main`
3. web, API, and optional edge deployment paths are proven
4. security debt is fixed or formally accepted with clear rationale
5. docs and agent guidance match the real system
6. rollback and operational readiness are tested, not assumed

---

## Phase 1: Stabilize The Web Quality Gate

**Goal:** make the current red or flaky web test lane deterministic

### Steps

1. Fix the three timing-out unit tests:
   - `tests/unit/health-route.test.ts`
   - `tests/unit/metrics-route.test.ts`
   - `tests/unit/worker-dispatch.test.ts`

2. Inspect why imports or setup are hanging:
   - dynamic imports in route tests
   - env-loading side effects
   - worker bootstrap doing too much at import time
   - DB, metrics, or logger initialization leaking into unit tests

3. Refactor for testability where needed:
   - isolate route logic from module-load side effects
   - lazy-initialize expensive dependencies
   - mock worker dependencies at clear boundaries

4. Re-run until stable:
   - `npm run test:coverage --workspace apps/web`
   - run it at least 3 consecutive times

5. After stability is proven:
   - keep the current threshold first
   - then raise coverage thresholds gradually if appropriate

### Exit Criteria

- `test:coverage` passes 3 times in a row locally
- no timeout-based failures
- coverage threshold is enforced and trusted

---

## Phase 2: Reconfirm The Local Engineering Baseline

**Goal:** prove the repo is healthy locally before leaning on CI

### Steps

1. Re-run:
   - `npm run readiness:audit --workspace apps/api`
   - `npm run lint --workspace apps/web`
   - `npm run typecheck --workspace apps/web`
   - `npm run typecheck --workspace apps/api`
   - `npm run test:coverage --workspace apps/web`

2. Re-run targeted E2E smoke:
   - `npm run test:e2e --workspace apps/web -- e2e/auth.spec.ts e2e/dashboard.spec.ts`

3. Re-run Docker builds locally:
   - `npm run docker:web`
   - `npm run docker:api`
   - optional: `npm run docker:edge`

4. Validate app boot from built images or equivalent production-like runtime

### Exit Criteria

- all local gates pass
- web Docker build completes successfully
- auth/dashboard smoke is green locally

---

## Phase 3: Get GitHub Actions Fully Green

**Goal:** convert local confidence into remote release confidence

### Steps

1. Push the prepared branch changes.
2. Watch these workflows closely:
   - `CI`
   - `Playwright Tests`
   - `docker-ghcr`
   - `production-gate`
   - `vercel-parity-build`

3. Fix failures in this order:
   1. `CI`
   2. `Playwright Tests`
   3. `docker-ghcr`
   4. parity/build drift

4. Keep CI assumptions aligned with local:
   - Postgres service
   - Redis service where required
   - Prisma setup
   - build-time envs for Next auth routes
   - stable test-user bootstrap

5. Require one clean green run on the branch, then one on `main`

### Exit Criteria

- all required GitHub Actions are green on branch
- green confirmation exists on `main`
- no unresolved local-vs-CI drift

---

## Phase 4: Close Security Debt

**Goal:** move from guarded-but-exposed to defensible

### Steps

1. Re-run production-focused audit:
   - `npm audit --omit=dev --workspace apps/web`
   - `npm audit --omit=dev --workspace apps/api`

2. Triage by severity:
   - fix all `critical`
   - fix all `high` where possible
   - document compensating controls for anything unfixed

3. Pay special attention to:
   - `xlsx` and any no-fix packages
   - packages touching HTML rendering, auth, email, uploads, or parsing

4. For no-fix dependencies, choose one path:
   - replace package
   - isolate usage behind a strict boundary
   - remove or narrow the feature
   - formally accept the risk with rationale

5. Confirm no secrets or tokens are embedded in remotes, docs, scripts, or sample envs

### Exit Criteria

- no unreviewed critical vulnerabilities
- highs are either fixed or explicitly accepted
- token hygiene is clean

---

## Phase 5: Prove Deployment And Runtime Behavior

**Goal:** production is not just buildable, it behaves correctly

### Steps

1. Validate production-like startup for:
   - web
   - API
   - edge optional

2. Check runtime endpoints:
   - health
   - readiness
   - metrics auth behavior

3. Validate key user paths end to end:
   - login
   - dashboard load
   - landing page render
   - lead capture
   - buyer-signal ingest happy path
   - AI-assisted generation guarded path

4. Validate failure modes:
   - missing Redis
   - invalid auth
   - insufficient credits
   - blocked prompt
   - DB transient failure
   - unauthorized metrics access

### Exit Criteria

- happy paths and failure paths are both verified
- optional infra degrades correctly
- no launch-critical route regressions

---

## Phase 6: Operational Readiness

**Goal:** make production survivable, not just deployable

### Steps

1. Confirm logging quality:
   - correlation IDs
   - structured logs
   - useful error context
   - no secret leakage

2. Confirm alerting coverage:
   - app down
   - DB unavailable
   - queue backlog or dead-letter growth
   - auth failure spikes
   - webhook failure spikes

3. Confirm runbooks exist and are current:
   - deploy
   - rollback
   - failed migration
   - queue backlog
   - provider outage
   - incident communication

4. Confirm ownership:
   - who responds to CI red
   - who responds to prod incidents
   - who owns dependency patching
   - who owns release signoff

### Exit Criteria

- alert path is real
- runbooks are current
- operational ownership is explicit

---

## Phase 7: Documentation And Governance Finish

**Goal:** keep the score from falling back

### Steps

1. Keep these docs aligned together:
   - `README.md`
   - `MASTER_SYSTEM_ARCHITECTURE.md`
   - `docs/ARCHITECTURE.md`
   - `docs/README.md`
   - `docs/context/ARCHITECTURE.md`
   - `docs/context/LAUNCH_READINESS.md`
   - latest readiness assessment

2. Mark older architecture docs as one of:
   - updated
   - historical
   - deprecated

3. Add or maintain a reusable release checklist covering:
   - local gates
   - CI gates
   - Docker gates
   - security gates
   - approval and signoff

4. Keep product-claim guardrails active in docs and UI copy review

### Exit Criteria

- no conflicting architecture story
- no inflated launch claims
- release checklist is reusable

---

## Phase 8: Final 100/100 Signoff

**Goal:** complete one final evidence-based pass

### Final Sequence

1. `npm run readiness:audit --workspace apps/api`
2. `npm run lint --workspace apps/web`
3. `npm run typecheck --workspace apps/web`
4. `npm run typecheck --workspace apps/api`
5. `npm run test:coverage --workspace apps/web`
6. `npm run test:e2e --workspace apps/web -- e2e/auth.spec.ts e2e/dashboard.spec.ts`
7. `npm run docker:web`
8. `npm run docker:api`
9. confirm green GitHub Actions
10. publish an updated readiness assessment with actual evidence

### Final 100/100 Conditions

- local gates are green
- CI is green
- Playwright smoke is green
- Docker builds are green
- security triage is complete
- docs are aligned
- rollback and ops confidence are verified

---

## Priority Order

For efficient execution, the order should be:

1. fix flaky web unit tests
2. reconfirm local coverage, lint, typecheck, and E2E
3. push and get GitHub Actions green
4. finish Docker proof
5. triage dependency security debt
6. complete ops and runbook pass
7. publish the final readiness reassessment

---

## Immediate Next Action

The next concrete work item should be:

1. push the current branch
2. confirm green runs for `CI`, `Playwright Tests`, `docker-ghcr`, and `vercel-parity-build`
3. capture or accept the remaining upstream moderate dependency findings
4. re-run Docker image proof in a stable builder environment if GitHub is the first green artifact source

That is now the shortest path from a locally launch-grade state to a true **100/100 production readiness score**.
