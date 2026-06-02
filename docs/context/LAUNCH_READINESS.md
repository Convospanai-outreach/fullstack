# Launch Readiness Wiki

## Current Launch Recommendation

The platform is suitable for controlled beta and operator-led rollout. It is **not yet ready for broad public production traffic**.

## Verified In This Reassessment

- `npm run readiness:audit --workspace apps/api` -> **pass**
- API readiness score -> **100/100**

## Current Blockers

1. Web coverage lane is not stable in the current tree.
   - `tests/unit/health-route.test.ts`
   - `tests/unit/metrics-route.test.ts`
   - `tests/unit/worker-dispatch.test.ts`
   - observed failure mode: timeout during reassessment

2. GitHub Actions need a fresh confirmed green run after recent local changes.
   - CI
   - Playwright
   - docker/registry build

3. Dependency security debt still needs remediation or formal acceptance.

4. Edge runtime remains optional and should not be part of the required launch gate.

## Recommended Recheck Order

1. `npm run readiness:audit --workspace apps/api`
2. `npm run lint --workspace apps/web`
3. `npm run test:coverage --workspace apps/web`
4. `npm run test:e2e --workspace apps/web -- e2e/auth.spec.ts e2e/dashboard.spec.ts`
5. confirm GitHub Actions are green on `main`

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
