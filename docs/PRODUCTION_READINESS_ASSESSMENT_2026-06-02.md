# CraftMyFunnel Production Readiness Assessment

**Date:** 2026-06-02  
**Assessment type:** repo-wide reassessment with architecture/doc refresh  
**Working tree during reassessment:** dirty, with local readiness/CI stabilization changes in progress

---

## Executive Verdict

**Overall readiness: 80/100**

The API service is in strong shape and its built-in readiness audit passes at **100/100**, but the full product is not yet broad-launch ready. The biggest regression found in this reassessment is that the web coverage lane is currently non-deterministic in the working tree, which lowers confidence in the release gate.

---

## What Was Verified

### API readiness audit

Command:

```bash
npm run readiness:audit --workspace apps/api
```

Result:

- **25/25 checks passed**
- **100/100**
- ready from the API audit perspective

### Architecture and docs

Verified current runtime shape:

- `apps/web` = public Next.js app
- `apps/api` = public Fastify API and worker runtime
- `apps/edge-fastapi` = optional private edge runtime
- `packages/toon-core` = shared package

This reassessment also found stale doc drift from older control-plane / managed-runtime descriptions. Those docs were updated to match the current repository.

---

## What Failed Or Remains Unconfirmed

### 1. Web coverage lane is currently red

Command:

```bash
npm run test:coverage --workspace apps/web
```

Observed result:

- 8 test files executed
- 30 tests discovered
- 3 tests failed by timeout

Affected tests:

- `tests/unit/health-route.test.ts`
- `tests/unit/metrics-route.test.ts`
- `tests/unit/worker-dispatch.test.ts`

This means the coverage gate cannot currently be treated as a reliable launch signal.

### 2. GitHub Actions confirmation is still missing

The local repo has fixes aimed at CI, Playwright, and Docker registry build paths, but this reassessment did not produce a fresh confirmed green run on GitHub for:

- `CI`
- `Playwright Tests`
- `docker-ghcr`

Until those runs are green on the remote branch, launch confidence remains partial.

### 3. Dependency security debt remains

The repo still carries npm audit backlog, especially in the API dependency graph. Some items may require upgrade, replacement, isolation, or explicit risk acceptance.

### 4. Container-build confidence is incomplete

The web Docker path has been improved locally, but a full end-to-end green container build was not reconfirmed in this reassessment.

---

## Scoring Breakdown

| Category | Score | Notes |
| --- | ---: | --- |
| Architecture clarity | 90 | Service boundaries are now documented accurately |
| API/runtime readiness | 96 | Audit passes 100/100 and runtime expectations are clear |
| Web quality gates | 55 | coverage lane currently flaky/red |
| CI/CD confidence | 68 | local fixes exist, remote green confirmation still missing |
| Security posture | 72 | guardrails are meaningful, dependency debt still open |
| Documentation quality | 90 | major stale topology drift corrected in this pass |
| **Overall** | **80** | good beta posture, not broad-launch green |

---

## CTO / CEO / CIO / DevOps / Customer Read

### CTO

Architecture is viable and better documented now, but release confidence is being held back by test determinism and missing GitHub confirmation.

### CEO

Do not announce broad production launch yet. Continue with controlled rollout or beta cohorts only.

### CIO

Governance and runtime controls are stronger than the docs previously suggested, but dependency risk and release evidence still need tightening.

### DevOps

The highest-value next step is a clean green pass through GitHub Actions after the local fixes, followed by container-build confirmation.

### Customer

The core product shape is coherent, but customer trust depends on auth, dashboard, health, and metrics paths staying stable under automation. The flaky coverage lane is a warning sign.

---

## Required Next Steps

1. Fix the three timing-out web unit tests and get `test:coverage` stable again.
2. Push current CI-related fixes and confirm green runs for `CI`, `Playwright Tests`, and `docker-ghcr`.
3. Reassess npm audit findings and either remediate or formally accept residual risk.
4. Reconfirm the web Docker build path in a reproducible environment.

---

## Updated Recommendation

**Status:** proceed with controlled beta, not broad production launch.

This repo is much closer to a trustworthy launch surface than the older docs implied, but it is also less green than a simple `100/100` API readiness score suggests. The right read is: strong core architecture, solid API readiness, incomplete web/CI proof.
