# PR #35 Security Audit Failure

Date: 2026-06-23
Agent: npm-lockfile-ci-stability-agent
PR: #35 `[codex] Repair root npm lockfile sync for CI`
Original failing head SHA inspected: `ff381c9a3676b7dbbd8b33cfcd8e18a579eea8ae`
Security-fix head SHA checked on GitHub: `b08bf9579a7ee5122f8f806ca3387f79ff5666e6`
Status after local fix: Security Audit fixed; GitHub rerun exposed a later unit-test blocker

## Failing Checks

GitHub Actions runs for PR head `ff381c9a3676b7dbbd8b33cfcd8e18a579eea8ae`:

- `CI`, run `28006893591`, failed.
- `Production Readiness Gate`, run `28006893636`, failed.
- `Vercel Parity Build`, run `28006893572`, succeeded.

Failed jobs:

- `CI / Web Build (apps/web)`, job `82890813147`, failed at step `Security Audit`.
- `Production Readiness Gate / Production Stability Audit (apps/web)`, job `82890812565`, failed at step `Security Audit`.

Both jobs installed dependencies successfully and skipped later Prisma/typecheck/lint/test/build/readiness steps only because the security audit step failed.

## GitHub Recheck After Security Fix

GitHub Actions reran for PR head `b08bf9579a7ee5122f8f806ca3387f79ff5666e6`.

- `Vercel Parity Build`, run `28016508686`, completed `success`.
- `CI`, run `28016508669`, completed `failure`.
- `Production Readiness Gate`, run `28016508642`, completed `failure`.
- Vercel deploy preview status completed `success`.
- Netlify deploy preview status completed `success`.

The originally failing `Security Audit` step passed in both web jobs on the rerun:

- `CI / Web Build (apps/web)`, job `82922055083`: `Security Audit` passed; `Unit Tests` failed later.
- `Production Readiness Gate / Production Stability Audit (apps/web)`, job `82922055069`: `Security Audit` passed; `Run Unit Tests` failed later.

The later unit-test failure was:

```text
tests/unit/landing-agent-routing-regression.test.ts
AssertionError: expected proxy.ts to contain 'path.startsWith("/p/")'
```

Root cause: `apps/web/src/proxy.ts` already whitelisted public `/p/*` routes through the equivalent `cleanPath.startsWith("/p/")` expression, while the merged regression test asserted the literal `path.startsWith("/p/")` guard. A one-line proxy alignment changed the guard to `path.startsWith("/p/")` without changing the public-route behavior.

## Exact Security Audit Command

Both failed jobs ran:

```bash
npm audit --audit-level=high --omit=dev
```

The command ran after:

```bash
npm ci --workspace apps/web --include-workspace-root --no-audit --no-fund --legacy-peer-deps
```

CI runner details from logs:

- OS: `ubuntu-22.04`
- Node: `v22.22.3`
- npm: `10.9.8`

## Exact Audit Output Summary

The failing command reported 10 vulnerabilities: 1 low, 5 moderate, 4 high.

| Package | Severity | Dependency path from logs | Fix available | Force/major required | Local verdict |
| --- | --- | --- | --- | --- | --- |
| `@babel/core <=7.29.0` | low | `node_modules/@babel/core` | `npm audit fix` | no | Not a high-gate blocker |
| `@opentelemetry/core <2.8.0` | moderate | `node_modules/@opentelemetry/core`; nested Sentry OpenTelemetry paths; via `@opentelemetry/resources` and `@opentelemetry/sdk-trace-base` | `npm audit fix --force` to `@opentelemetry/core@2.8.0` | yes, breaking | Deferred to Stage 13 |
| `dompurify <=3.4.10` | moderate | `node_modules/dompurify` | `npm audit fix` | no | Deferred to Stage 13 |
| `nodemailer <=9.0.0` | high | CI log showed `apps/web/node_modules/nodemailer`; local root audit also showed `apps/api/node_modules/nodemailer` | `npm audit fix --force` to `nodemailer@9.0.1` | npm marks semver major from `^8.0.10` | Fixed with targeted direct dependency update to `^9.0.1` in web and API |
| `uuid 13.0.0` / nested `uuid <11.1.1` | moderate | CI log showed `node_modules/uuid`; after fix remaining local item is `node_modules/next-auth/node_modules/uuid` via `next-auth` | root UUID has non-force fix; NextAuth nested fix requires force/downgrade per npm | NextAuth path requires force/breaking | Deferred to Stage 13; do not blindly change NextAuth |
| `ws 8.0.0 - 8.20.1` | high | `node_modules/ws`; via `engine.io` and `socket.io-adapter` | `npm audit fix` | no | Fixed with targeted transitive patch to `ws@8.21.0`, `engine.io@6.6.9`, and `socket.io-adapter@2.5.8` |

## Cause Classification

- Existing known vulnerability: yes. The failure is the Stage 13 dependency-security issue surfacing in CI.
- Root lockfile repair side effect: no. PR #35 fixed root `npm ci`; after that succeeded, the workflow progressed to the pre-existing audit gate.
- Workspace package-lock mismatch: no evidence from the failure. The failing logs show workspace install succeeded before audit.
- npm 10 vs npm 11 audit behavior: not the root cause. npm 10 in CI and local npm 11 both failed before the targeted high fixes and pass the high threshold after the fix.
- Dependabot PR #22/PR #32 residue: no. PR #32 remains reverted; this fix does not reapply the grouped bump.
- Overly strict workflow threshold: no. The workflow gates on high production vulnerabilities. The high `nodemailer` and `ws` findings are legitimate release blockers under the current policy.

## Fix Applied

Targeted, non-force remediation:

- `apps/web/package.json`: `nodemailer` changed from `^8.0.10` to `^9.0.1`.
- `apps/api/package.json`: `nodemailer` changed from `^8.0.10` to `^9.0.1`.
- `package.json`: added root override `ws: 8.21.0` to force the patched transitive WebSocket package without adding a new root production dependency.
- `package-lock.json`: regenerated by npm to reflect:
  - `apps/web/node_modules/nodemailer@9.0.1`
  - `apps/api/node_modules/nodemailer@9.0.1`
  - `engine.io@6.6.9`
  - `socket.io-adapter@2.5.8`
  - `ws@8.21.0`
  - preserved npm 10-required `@emnapi/core@1.11.1` and `@emnapi/runtime@1.11.1`

Commands used:

```powershell
npm install --package-lock-only --ignore-scripts --no-audit --no-fund --workspace apps/web nodemailer@^9.0.1
npm install --package-lock-only --ignore-scripts --no-audit --no-fund --workspace apps/api nodemailer@^9.0.1
npm pkg set overrides.ws=8.21.0
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npx -p npm@10 npm install --package-lock-only --ignore-scripts --no-audit --no-fund --loglevel=error
```

No `npm audit fix --force` was run.

## Local Validation

Security audit:

```powershell
npm audit --audit-level=high --omit=dev
```

Result: passed with exit code `0`. It still reports 7 low/moderate vulnerabilities, but no high vulnerabilities. Remaining low/moderate findings are Stage 13 follow-up work.

npm 10 lockfile sync check:

```powershell
npx -p npm@10 npm ci --dry-run --loglevel=error
```

Result: passed with exit code `0`. npm printed the dry-run install plan; no lockfile sync error remained.

Workspace install mirror:

```powershell
npm ci --workspace apps/web --include-workspace-root --no-audit --no-fund --legacy-peer-deps
```

Result: timed out locally after 604s. This is documented as not passed locally; the required npm 10 dry-run and audit gate passed.

Prisma generate before standalone typecheck:

```powershell
npx prisma generate --config prisma/prisma.config.ts --schema prisma/schema.prisma
```

Result: passed from `apps/web` in 39.3s with dummy DB URLs.

Typecheck:

```powershell
npm run typecheck --workspace apps/web
```

First run failed before Prisma generate with stale/generated-client-related errors. After Prisma generate, it passed in 205.8s.

Build:

```powershell
npm run build --workspace apps/web
```

Result: passed in 945.8s with dummy DB URLs and CI placeholder auth env.

Targeted landing-agent regression test after the GitHub unit-test failure:

```powershell
npm --workspace apps/web run test:unit -- tests/unit/landing-agent-routing-regression.test.ts
```

Result: passed locally with 13 test files and 78 tests passing.

## Remaining Risks

- GitHub Actions must rerun on the pushed commit containing the proxy alignment and turn green before PR #35 is marked ready.
- Vercel and Netlify preview checks must remain green.
- Low/moderate audit findings remain and are tracked separately in Stage 13.
- This does not claim production readiness or controlled beta readiness.

## Safety Confirmation

- Did not merge PR #35.
- Did not mark PR #35 ready for review.
- Did not run `npm audit fix --force`.
- Did not reapply Dependabot PR #32 or PR #22.
- Did not make broad dependency upgrades.
- Did not touch DB schema, Prisma schemas, migrations, Supabase production data, Vercel/Railway/Clerk/Redis secrets/env, PR #6, OAuth scopes, Chrome permissions, LinkedIn automation behavior, production deployment config, or cosmetic UI.
