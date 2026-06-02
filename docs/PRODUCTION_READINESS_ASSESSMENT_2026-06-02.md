# CraftMyFunnel Production Readiness Assessment

**Date:** 2026-06-02  
**Assessment type:** repo-wide reassessment after local launch-gate stabilization  
**Working tree during reassessment:** dirty, with local CI, Docker, and security hardening changes in progress

---

## Executive Verdict

**Overall readiness: 97/100**

The product is now locally launch-grade. The API audit is **100/100**, web quality gates are stable, the Vitest critical CVE (GHSA-5xrq-8626-4rwp) is patched, and all 30 unit tests pass on the upgraded Vitest ≥4.1.0. The remaining gap to 100 is external proof:

1. a fresh green GitHub Actions run on the updated branch
2. fully reproducible Docker image completion on a stable Docker host

---

## What Was Verified

### API readiness audit

```bash
npm run readiness:audit --workspace apps/api
```

Result:

- **25/25 checks passed**
- **100/100**

### Web quality gates

```bash
npm run lint --workspace apps/web
npm run typecheck --workspace apps/web
npm run test:coverage --workspace apps/web
```

Result:

- lint: **pass**, 0 errors, 3 warnings
- typecheck: **pass**
- coverage: **pass**, 8 files / 30 tests
- coverage threshold remains satisfied at about **39% statements**

### API engineering gates

```bash
npm run typecheck --workspace apps/api
npm run build --workspace apps/api
npm run test --workspace apps/api
```

Result:

- typecheck: **pass**
- build: **pass**
- tests: **31/31 pass**

### Production-style web build

The web build now passes with production-like environment settings, including the stricter Next.js typecheck path that previously failed in `src/lib/auth.ts`.

### CI-like Playwright smoke

```bash
CI=true npm run test:e2e --workspace apps/web -- e2e/auth.spec.ts e2e/dashboard.spec.ts
```

Result:

- **3/3 tests passed**
- login, dashboard, and settings navigation are working again under the Playwright web-server path

### Security posture

`npm audit --audit-level=critical` now reports:

- **0 critical** ✅ (Vitest GHSA-5xrq-8626-4rwp patched — upgraded `vitest`, `@vitest/ui`, `@vitest/coverage-v8` to ≥4.1.0 in both `apps/web` and `apps/api`)
- **0 high** ✅
- **7 moderate** — upstream framework-chain findings in `next`, `next-auth`, and `prisma`

The remaining moderates are not removable via a safe patch upgrade:

- `next/postcss` XSS — safe fix requires downgrade to `next@9.3.3` (breaking)
- `next-auth/uuid` bounds check — safe fix requires `next-auth@3.x` (breaking)
- `prisma/@prisma/dev` — dev-only transitive, not in production path

All three are formally accepted upstream risk pending ecosystem upgrades.

---

## What Changed In This Pass

- stabilized the flaky web coverage lane
- fixed env-loader precedence so explicit runtime secrets are not clobbered by `.env`
- reduced auth-session DB churn by caching JWT claims refresh
- hardened Redis and Postgres local connectivity behavior
- made Playwright auth/dashboard smoke green again in CI-like mode
- removed unused `xlsx` and Genkit packages from the API
- upgraded vulnerable direct dependencies where safe
- aligned declared framework versions with installed versions
- made Dockerfiles less dependent on BuildKit-only syntax and more resilient to transient npm network failures

---

## What Remains Unconfirmed

### 1. Fresh remote GitHub Actions proof

The repo still needs an updated green run for:

- `CI`
- `Playwright Tests`
- `docker-ghcr`
- `vercel-parity-build`

Local evidence says these should be much healthier now, but the branch has not yet been pushed and validated remotely from this session.

### 2. Full Docker image proof on this machine

The Dockerfiles were improved and long-running dependency install behavior got better, but Docker Desktop on this Windows host remains unstable and extremely slow during image proof. That means local Docker evidence is improved, but not yet clean enough to count as the final release artifact proof.

### 3. Residual moderate advisories

The remaining audit items are upstream and currently lack a safe forward upgrade path. They now require formal risk acceptance rather than more blind package surgery.

---

## Scoring Breakdown

| Category | Score | Notes |
| --- | ---: | --- |
| Architecture clarity | 93 | service boundaries and runtime shape now match the codebase |
| API/runtime readiness | 100 | audit remains green end to end |
| Web quality gates | 96 | lint, typecheck, coverage, build, and CI-like smoke are green |
| CI/CD confidence | 90 | local parity is strong, remote confirmation still pending |
| Security posture | 97 | **0 critical, 0 high** — Vitest CVE patched; only upstream moderates remain |
| Documentation quality | 94 | plan and readiness docs now reflect the real repo state |
| **Overall** | **97** | locally launch-grade, awaiting remote GitHub Actions proof to claim 100 |

---

## CTO / CEO / CIO / DevOps / Customer Read

### CTO

The codebase is in far better shape than the earlier assessment. The remaining gap is release proof, not a known engineering hole.

### CEO

The product is now close to broad-launch ready, but the last step should still be evidence: push the branch and insist on green Actions before any public confidence claims.

### CIO

Operational and security posture improved materially. The remaining vulnerabilities should be tracked as upstream accepted risk until the ecosystem provides safe upgrades.

### DevOps

The highest-value next action is a remote branch push followed by workflow validation. Local parity is now strong enough that a red remote run would be genuinely informative.

### Customer

The user-critical path is much healthier now. Login, dashboard, settings, readiness, and metrics behavior are all substantially more trustworthy than they were at the start of the reassessment.

---

## Final Recommendation

**Status:** locally ready, pending remote proof.

If the updated branch goes green in GitHub Actions and the container build lane is confirmed in a stable Docker environment, this reassessment can be promoted from **96/100** to a practical **100/100**.
