# App Failure Matrix (2026-04-02)

## Goal
Identify where the app fails across web/api/edge, and where uncommitted code likely causes runtime drift.

## Findings Summary

1. `apps/web` and `apps/api` typecheck runs are unstable in the current dirty workspace when run via workspace npm scripts (timeouts observed in prior audit runs).
2. `apps/edge-fastapi` import/runtime checks fail on this machine's active Python because required packages are missing (`fastapi`, `sqlalchemy`) even though syntax compilation passes.
3. There are uncommitted runtime-critical support files which can explain "works on one machine but not another" behavior.

## Repro Commands and Status

1. Web typecheck
- Command: `npm run typecheck --workspace apps/web`
- Status: timed out in audit run (no diagnostics produced before timeout)

2. API typecheck
- Command: `npm run typecheck --workspace apps/api`
- Status: timed out in audit run (no diagnostics produced before timeout)

3. API compile baseline
- Command: `npm run build --workspace apps/api`
- Status: PASS (`tsc -p tsconfig.json`)

4. Edge import check
- Command: `python -c "import fastapi, sqlalchemy; print('imports-ok')"`
- Status: FAIL (`ModuleNotFoundError: No module named 'fastapi'`)

5. Edge syntax compile
- Command: `python -m py_compile apps/edge-fastapi/main.py apps/edge-fastapi/database.py apps/edge-fastapi/services/local_intelligence.py`
- Status: PASS

## Uncommitted Files Most Likely To Cause Drift

- `apps/web/scripts/run-with-env.mjs`
- `apps/web/scripts/repair-package-exports.mjs`
- `apps/api/scripts/`
- `apps/api/src/types/hubspot-api-client.d.ts`
- `apps/web/src/types/hubspot-api-client.d.ts`
- `apps/web/src/types/next-server-shim.d.ts`

These files are referenced by existing build/runtime flows and are currently uncommitted in this workspace.

## Root-Cause Hypothesis

1. The repo is in a partially migrated state with many local-only changes.
2. Workspace scripts rely on local uncommitted support files.
3. Repeated interrupted runs leave stale processes and lock files, increasing timeout probability.
4. Edge app runtime environment is not provisioned in the active Python interpreter.

## Immediate Stabilization Actions

1. Commit or intentionally remove runtime-critical uncommitted helper files listed above.
2. Kill stale `node/npm/tsc` processes before heavy checks.
3. Run direct `tsc -p` per app to get deterministic compile diagnostics before full workspace scripts.
4. Provision edge deps from:
- `apps/edge-fastapi/requirements.txt`
- `apps/edge-fastapi/requirements.runtime.txt`

## Recommended CI Additions

1. Add a preflight that fails if key support files are locally modified/untracked.
2. Add per-app compile checks (`tsc -p`) separate from broader script wrappers.
3. Add edge python import smoke (`fastapi`, `sqlalchemy`) in edge pipeline.
