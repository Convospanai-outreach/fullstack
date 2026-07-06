# Production Health Hardware Verification RCA

## Scope
Follow-up after PR #68 was merged and production still returned 500.

## Evidence
- PR #68 merged and deployed.
- GitHub CI passed on PR #70.
- Vercel production deployment is Ready.
- Aliases mapped to `craftmyfunnel.live` and `www.craftmyfunnel.live`.
- Production probes still returned 500 for:
  - `/api/health`
  - `/api/health?probe=live`
  - `/api/health?probe=ready`
- Vercel runtime logs showed `Starting Hardware Verification...` during `/api/health`.
- `apps/web/src/instrumentation.ts` was found to run `HardwareService.verifyHardwareIdentity()`.
- `apps/web/src/services/HardwareService.ts` defaults `API_BASE` to `NEXT_PUBLIC_API_URL` or `http://localhost:3001/api`.

## Root Cause Hypothesis
The likely remaining failure is web instrumentation coupling serverless health requests to hardware/API verification during serverless startup.

## Fix Applied
- Web instrumentation no longer runs hardware verification by default on Vercel/serverless.
- Hardware verification is now opt-in for the web runtime and remains skipped under beta/serverless conditions.
- The dynamic import was moved inside the guarded `try` block.
- No health route DB/readiness behavior was changed.

## Safety
- No DB/schema/migration/env changes.
- No secrets exposed.
- No production-readiness claim.
- No auth weakening.
- No removal of `HardwareService`.

## Verification
- `npx vitest run tests/unit/health-route.test.ts` -> PASS
- `npm run typecheck --workspace apps/web` -> PASS
- `npm run lint --workspace apps/web` -> FAIL in the workspace lint wrapper with `JSON parse failed: EOF while parsing a value at line 1 column 0`
- The lint wrapper EOF failure was already observed in earlier health-boundary work and is treated as a separate process/tooling gap.
- This PR does not fix the lint wrapper so scope stays narrow.
- Post-deploy probes are still required.
- Instrumentation now skips hardware verification in serverless web runtime by default and logs a concise skip message instead of starting hardware verification.

## Verdict
YELLOW: local fix ready; production proof pending
