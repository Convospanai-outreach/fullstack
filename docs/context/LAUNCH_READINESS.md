# Launch Readiness Wiki

## Current Launch Recommendation

The platform is now locally suitable for launch validation. It is **very close to broad public production readiness**, but the final claim still depends on remote GitHub Actions proof and reproducible Docker image confirmation.

## Verified In This Reassessment

- `npm run readiness:audit --workspace apps/api` -> **pass**
- API readiness score -> **100/100** (26/26 checks passed)
- `npm run lint --workspace apps/web` -> **pass**
- `npm run typecheck --workspace apps/web` -> **pass**
- `npm run test:unit --workspace apps/web` -> **pass** (13/13 test files, 78/78 tests)
- `npx tsx scripts/verify-all.ts` -> **pass** (5/5 pre-deployment audit suites)
- production-style web build -> **pass**

## Current Blockers

1. GitHub Actions need a fresh confirmed green run after recent local changes.
   - CI
   - Playwright
   - docker/registry build

2. Docker image proof on this Windows host is still noisy and slow.
   - Dockerfiles were hardened
   - local Docker Desktop behavior is still not clean enough to count as final artifact proof

3. Residual moderate dependency advisories still need formal acceptance.
   - no high
   - no critical
   - remaining items are upstream `next`, `next-auth`, and `prisma` chains

4. Edge runtime remains optional and should not be part of the required launch gate.

## Recommended Recheck Order

1. `npm run readiness:audit --workspace apps/api`
2. `npm run lint --workspace apps/web`
3. `npm run typecheck --workspace apps/web`
4. `npm run test:coverage --workspace apps/web`
5. `CI=true npm run test:e2e --workspace apps/web -- e2e/auth.spec.ts e2e/dashboard.spec.ts`
6. confirm GitHub Actions are green on `main`

## Deploy Order

1. ensure Postgres is reachable
2. deploy `apps/api`
3. deploy `apps/web`
4. enable or keep disabled any edge-only features
5. deploy `apps/edge-fastapi` only if the cohort actually needs it

## Rollback Priorities

1. disable risky feature flags first
2. stop edge-only traffic before touching core web/API
3. preserve Postgres schema integrity
4. keep Redis optional during rollback decisions
