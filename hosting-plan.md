# Hosting Plan

## Recommended Production Topology

Use a **Railway-first deployment** for the initial production launch.

Why this is the best fit for the current repo:

- The repository is already split into `apps/web`, `apps/api`, and `apps/edge-fastapi`.
- There is an existing split local topology in [`apps/docker-compose.split.yml`](./apps/docker-compose.split.yml).
- The app expects internal service-to-service traffic for the API, Postgres, and edge node.
- Railway gives private service networking, managed Postgres, volumes, and backups in one project.

### Target layout

- `app.convospan.com` -> `apps/web` as a public Railway web service
- `api.convospan.com` -> `apps/api` as a public Railway web service
- `edge-internal` -> `apps/edge-fastapi` as a private Railway service
- `postgres` -> Railway PostgreSQL service
- `redis` -> Railway Redis service if Redis-backed queues/rate limits are needed in production

## Rollout Phases

### Phase 1: Stable launch

Deploy everything on Railway first.

- `apps/web` talks to `apps/api` over HTTPS using `NEXT_PUBLIC_API_URL=https://api.convospan.com`
- `apps/api` talks to Postgres, Redis, and `apps/edge-fastapi` over Railway private networking
- `apps/edge-fastapi` remains private unless an external integration truly requires direct access

This keeps the first production rollout simple and avoids cross-vendor networking problems.

### Phase 2: Frontend optimization

After the web build is consistently green and the app is stable in production:

- optionally move `apps/web` to Vercel
- keep `apps/api`, Postgres, Redis, and `apps/edge-fastapi` on Railway

Do this only after launch. It is an optimization, not the safest first deployment.

## Service Plan

### 1. `apps/web`

Host as a Railway web service first.

Build command:

```bash
npm run build --workspace apps/web
```

Start command:

```bash
npm run start --workspace apps/web
```

Notes:

- The web app is Next 16 and currently relies on a repair hook in [`apps/web/package.json`](./apps/web/package.json) to stabilize the local dependency tree.
- The web production build has been pushed much further, but it is not yet fully verified green in this workspace.
- The app currently uses webpack for production build, not Turbopack.

### 2. `apps/api`

Host as a Railway web service.

Build command:

```bash
npm run build --workspace apps/api
```

Start command:

```bash
npm run start --workspace apps/api
```

Notes:

- This service should be the public backend entrypoint.
- Health checks should use the existing health route family already referenced in the codebase.

### 3. `apps/edge-fastapi`

Host as a private Railway service.

Notes:

- Keep this private behind Railway networking.
- Attach a volume only if you truly need persistent local model storage.
- If the current model path is optional in cloud mode, avoid volume coupling for the first launch.

### 4. PostgreSQL

Use Railway PostgreSQL for the first production environment.

Notes:

- Backups should be enabled immediately.
- Prisma migrations should be run from CI or a one-off deploy job before traffic cutover.

### 5. Redis

Use Railway Redis if the API owns Redis-backed work.

Use Upstash only if the web app must hit Redis directly from a serverless frontend later.

## Domains

Use:

- `app.convospan.com` for `apps/web`
- `api.convospan.com` for `apps/api`
- no public domain for `apps/edge-fastapi`

Keep marketing and app traffic on the same web deployment unless you deliberately split them later.

## Environment Variables

Minimum production variables by role:

### Shared

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### Web

- `NEXT_PUBLIC_API_URL`
- `EDGE_NODE_URI` only if the web service must call the edge node directly
- Sentry/PostHog/public analytics vars if enabled

### API

- `DATABASE_URL`
- `EDGE_NODE_URI`
- `REDIS_URL` if Redis is used
- provider keys for OpenAI, Anthropic, Google AI, HubSpot, Razorpay, email providers, and any outbound integrations

### Edge FastAPI

- `DATABASE_URL` if it reads or writes shared state
- `EDGE_MODE`
- model path / hardware identity variables if still required by runtime logic

## Deployment Order

1. Provision Railway project and environments: `staging`, then `production`.
2. Create PostgreSQL and Redis.
3. Deploy `apps/edge-fastapi` as private.
4. Deploy `apps/api` and point it to private Postgres/Redis/edge URLs.
5. Run Prisma generate and migrations in the deploy pipeline.
6. Deploy `apps/web` with `NEXT_PUBLIC_API_URL` pointing at the public API domain.
7. Add custom domains and TLS.
8. Enable backups, health checks, and alerts.
9. Run Playwright smoke tests against staging before production cutover.

## CI/CD Plan

Use GitHub Actions with two environments:

- `staging` on every merge to `main`
- `production` on tagged release or manual approval

Pipeline steps:

1. install dependencies
2. run `npm run build --workspace apps/api`
3. run `npm run build --workspace apps/web`
4. run Prisma generate / migrations for the target environment
5. deploy API
6. deploy web
7. run post-deploy smoke tests

## Health Checks

Wire health checks around the routes already implied in the repo:

- API health: the API codebase contains a system health route family under [`apps/api/routes/v1/system/health/route.ts`](./apps/api/routes/v1/system/health/route.ts)
- Web monitoring references `/health` and `/monitoring/health` in the current code paths
- Edge node health is expected at `EDGE_NODE_URI/health`

Before cutover, standardize one public API health endpoint and one internal edge health endpoint.

## Current Pre-Deploy Blockers

These should be treated as launch blockers:

- `apps/web` production build is not yet confirmed clean end-to-end in this workspace
- the web app still carries a dependency repair script in [`apps/web/scripts/repair-package-exports.mjs`](./apps/web/scripts/repair-package-exports.mjs), which should be reduced or eliminated before a clean production rollout
- `middleware` should be migrated to the newer `proxy` convention in [`apps/web/src/middleware.ts`](./apps/web/src/middleware.ts)
- Prisma generation works here only when temp files are redirected to a writable local temp directory; the CI/deploy pipeline should set an explicit temp path on Windows runners or use Linux runners

## Recommendation Summary

For the first real launch:

- host **everything on Railway**
- keep only `web` and `api` public
- keep `edge-fastapi`, Postgres, and Redis private
- use staging first, then production
- do not move the frontend to Vercel until the web build is fully clean and repeatable

## External References

- Vercel cron jobs: https://vercel.com/docs/cron-jobs
- Vercel cron management and `CRON_SECRET`: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Render private services: https://render.com/docs/private-services
- Render background workers: https://render.com/docs/background-workers
- Render cron jobs: https://render.com/docs/cronjobs
- Railway private networking: https://docs.railway.com/private-networking
- Railway PostgreSQL: https://docs.railway.com/databases/postgresql/
- Railway volumes: https://docs.railway.com/volumes/reference
- Railway pricing: https://docs.railway.com/pricing
