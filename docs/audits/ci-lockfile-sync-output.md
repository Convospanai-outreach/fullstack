# CI Lockfile Sync Output

Date: 2026-06-23
Agent: npm-lockfile-ci-stability-agent
Branch: `codex/repair-root-lockfile-npm-ci`
Base commit: `7fcfff7eee29f7dbc37aa9623faab0c1924c67f7`
Status: READY_FOR_NEXT_STAGE

## Scope

Repair the root `package-lock.json` so the `vercel-parity-build` workflow can run root `npm ci` without package/lockfile sync failure.

No package manifests, workspace lockfiles, source code, Prisma schemas, migrations, DB config, Vercel env, production deployment config, OAuth scopes, Chrome extension permissions, or PR #6 files were changed.

## Branch And Revert Checks

- Current branch was not `main` before repair work.
- New branch was created from `origin/main`:
  - `codex/repair-root-lockfile-npm-ci`
- Branch base:
  - `7fcfff7eee29f7dbc37aa9623faab0c1924c67f7`
- PR #32 remains reverted:
  - `git log --oneline --decorate --max-count=12 --all --grep="Dependabot\|dependency bump\|Revert"` showed `7fcfff7 Merge pull request #33 from Convospanai-outreach/codex/revert-dependabot-pr32` and `737d2e6 Revert "Merge pull request #32 from Convospanai-outreach/dependabot/npm_and_yarn/npm_and_yarn-6ef0305fb7"`.

## Reproduction

Initial local root `npm ci` using npm `11.6.2` timed out twice before emitting a useful sync failure:

- `npm ci` timed out after 120s.
- `npm ci` timed out after 424s.

The failing GitHub workflow uses `actions/setup-node@v4` with Node `22`, so the failure was reproduced with npm 10:

```powershell
npx -p npm@10 npm ci --no-audit --no-fund --loglevel=error
```

Result: failed in 117.4s with `EUSAGE` lockfile sync error.

Missing from root lockfile under npm 10:

- `@emnapi/core@1.11.1`
- `@emnapi/runtime@1.11.1`
- `uuid@14.0.1` in `apps/api`
- `uuid@14.0.1` in `apps/web`

After lockfile repair, root `npm ci` with the local toolchain passed:

```powershell
node -v
npm -v
npm ci
```

Result:

- Node: `v24.11.0`
- npm: `11.6.2`
- `npm ci` exit code: `0`
- Duration: 847.2s
- `@emnapi/core@1.11.1` present in root `package-lock.json`: yes
- `@emnapi/runtime@1.11.1` present in root `package-lock.json`: yes
- npm reported existing audit vulnerabilities: 1 low, 5 moderate, 4 high. These remain separate dependency-security work and were not changed by this lockfile repair.

## Root Cause

The root workspace lockfile was accepted by local npm 11 but was incomplete for npm 10, which is the npm major used by the GitHub Actions Node 22 setup. npm 10 resolved additional peer/install metadata for optional native/WASI dependency paths and workspace-local `uuid` installs, then rejected `npm ci` because the required entries were absent from `package-lock.json`.

This is a lockfile synchronization issue, not a package manifest bump.

## Dependency Chain

Commands run:

```powershell
npm explain @emnapi/core
npm explain @emnapi/runtime
npm ls @emnapi/core @emnapi/runtime
npm explain @napi-rs/wasm-runtime
npm explain @rolldown/binding-wasm32-wasi
npm explain @unrs/resolver-binding-wasm32-wasi
```

Results:

- `npm explain @emnapi/core` showed `@emnapi/core@1.11.1` as a peer required by `@napi-rs/wasm-runtime@1.1.4`.
- `npm explain @emnapi/runtime` showed `@emnapi/runtime@1.11.1` as a peer required by `@napi-rs/wasm-runtime@1.1.4`.
- `npm ls @emnapi/core @emnapi/runtime` showed both root entries present and deduped under `@napi-rs/wasm-runtime@1.1.4`.
- `npm explain @rolldown/binding-wasm32-wasi` and `npm explain @unrs/resolver-binding-wasm32-wasi` did not find installed dependencies on the current Windows host because these are optional WASI/platform lockfile entries.

Package-lock inspection identified the parent chain:

- `@napi-rs/wasm-runtime@1.1.4` has peer dependencies on `@emnapi/core@^1.7.1` and `@emnapi/runtime@^1.7.1`.
- `@rolldown/binding-wasm32-wasi@1.0.3` depends on `@napi-rs/wasm-runtime@^1.1.4` and nested `@emnapi/core@1.10.0` / `@emnapi/runtime@1.10.0`; it is an optional `wasm32` binding under `rolldown@1.0.3`.
- `rolldown@1.0.3` is required by `vite@8.0.16`.
- `vite@8.0.16` is a devDependency of `apps/web`.
- `@unrs/resolver-binding-wasm32-wasi@1.12.2` depends on `@napi-rs/wasm-runtime@^1.1.4` and nested `@emnapi/core@1.10.0` / `@emnapi/runtime@1.10.0`; it is an optional `wasm32` binding under `unrs-resolver@1.12.2`.
- `unrs-resolver@1.12.2` is required by `eslint-import-resolver-typescript@3.10.1`.
- `eslint-import-resolver-typescript@3.10.1` is required by `eslint-config-next@16.1.6`.

## Fix

Ran npm 10 in lockfile-only mode:

```powershell
npx -p npm@10 npm install --package-lock-only --ignore-scripts --no-audit --no-fund --loglevel=error
```

Result: passed in 86.8s and updated only root `package-lock.json`.

The lockfile update added missing npm 10 install metadata, including:

- root `node_modules/@emnapi/core@1.11.1`
- root `node_modules/@emnapi/runtime@1.11.1`
- `apps/api/node_modules/uuid@14.0.1`
- `apps/web/node_modules/uuid@14.0.1`

It also normalized npm 10 peer markers in the root lockfile.

## Validation

Root clean install with npm 10:

```powershell
npx -p npm@10 npm ci --no-audit --no-fund
```

Result: passed in 789.2s.

Additional sync check:

```powershell
npx -p npm@10 npm ci --dry-run --loglevel=error
```

Result: passed in 54.6s with exit code `0`; npm printed the dry-run optional platform package plan, but no lockfile sync error remained.

Vercel parity workflow-equivalent commands:

```powershell
npm ci
node scripts/check-web-prisma-imports.mjs
```

Results:

- `npm ci` passed in 847.2s with exit code `0`.
- `node scripts/check-web-prisma-imports.mjs` passed in 5.2s with exit code `0`; output: `No forbidden @prisma/client imports found in apps/web.`

From `apps/web`:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/dummy'
$env:DIRECT_URL='postgresql://postgres:postgres@localhost:5432/dummy'
npx prisma generate --config prisma/prisma.config.ts --schema prisma/schema.prisma
```

Result: passed in 35.0s with exit code `0`; Prisma Client v7.8.0 generated successfully.

From `apps/web`:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/dummy'
$env:DIRECT_URL='postgresql://postgres:postgres@localhost:5432/dummy'
$env:SKIP_ENV_VALIDATION='true'
$env:NEXTAUTH_SECRET='ci-parity-secret-not-real'
$env:NEXTAUTH_URL='http://localhost:3000'
npm run build
```

Result: passed in 917.5s with exit code `0`. The build compiled successfully, completed TypeScript, generated 125 static pages, and finalized traces.

Notes:

- Install completed with 1274 packages added.
- npm reported deprecated-package warnings for existing dependencies.
- npm reported a Windows cleanup `EPERM` warning for an old `node_modules` directory removal, but the install exited `0`.

## Remaining Risks

- Exact GitHub Actions status must still be verified on the pushed branch/PR.
- This does not remediate Dependabot/npm audit alerts.
- Overall workflow remains NEEDS_REPLAN because DB, dependency audit, production branch alignment, unsafe migration, API origin, and PR #6 blockers remain.
- This does not claim production readiness or controlled beta readiness.
