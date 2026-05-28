# Split Audit (2026-03-21)

## Critical failures in current layout

1. Web container command and image stage are mismatched.
   - `docker-compose.yml` runs `node server.js`, but the Dockerfile's web stage runs `server-custom.js`.
   - Docker default target is the last stage (`runner-worker`), so `craftmyfunnel-web` may build from the worker image.
   - Files: `docker-compose.yml`, `Dockerfile`

2. Edge node defaults to local DB host that is invalid inside container.
   - `services/edge-node/database.py` defaults to `localhost:5433`; inside container this points to itself, not Postgres.
   - Startup calls `init_db()` immediately, so boot fails when DB is unreachable.
   - File: `services/edge-node/database.py`

3. FastAPI edge endpoints and caller endpoints are inconsistent.
   - Edge exposes `/v1/sanitize`, `/v1/critique`.
   - `HardwareService` calls `/sanitize`, `/critique` and extra endpoints not present in edge runtime.
   - Files: `services/edge-node/main.py`, `src/services/HardwareService.ts`

4. Edge feature mode is disabled by default.
   - `EDGE_MODE` default is disabled; all `/v1/*` feature endpoints return 503 until enabled.
   - File: `services/edge-node/main.py`

5. API split is not truly independent in current original structure.
   - `apps/api/tsconfig.json` now uses `baseUrl: "src"` and imports `@/*` from the app-local `src`.
   - This means API cannot be moved without carrying shared code.
   - File: `apps/api/tsconfig.json`

## Build-time shortcomings observed

1. `npm run build --workspace apps/api` is the current build entrypoint for the split API app.
2. Root repo has mixed runtime patterns (Next.js API, Fastify API, Edge FastAPI, Managed FastAPI) which increases drift risk.
3. Docker and runtime configs are duplicated across multiple compose files with inconsistent env names.

## New split created

- `apps/web` (standalone Next.js app + Dockerfile + git repo)
- `apps/api` (standalone Fastify app + copied shared src + Dockerfile + git repo)
- `apps/edge-fastapi` (standalone FastAPI edge app + Dockerfile + git repo)
- `apps/docker-compose.split.yml` (build/run all three)
