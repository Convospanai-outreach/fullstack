# ConvoSpan Monorepo

ConvoSpan is a multi-app monorepo with three deployable applications under `apps/`.

- `apps/web` - Next.js web app (UI + web route handlers)
- `apps/api` - Fastify API app (core backend + workers)
- `apps/edge-fastapi` - optional FastAPI edge runtime

Root is orchestration only (scripts, shared config, CI, docs). It is not a deployable app.

## Why 3 apps in 1 repo

Single repo is intentional. It lets you:

- ship cross-app changes atomically (web + api + schema + docs in one PR)
- keep one CI pipeline with path-based deploy triggers
- share standards (TypeScript config, security policies, scripts)
- avoid version drift between API contracts and frontend usage

This is a standard monorepo model: one git repo, multiple independently deployed apps.

## Local startup (fast path)

```bash
npm run beta:start
```

What this does:

1. starts `db` and `redis` containers
2. pushes API Prisma schema to local DB
3. starts API and web
4. if API/web are already running, it reuses them instead of crashing on port conflicts

## Build commands

```bash
npm run build:web
npm run build:api
```

## Deploy separately from one repo

Deploy each app as its own service, still from this single repository:

- Service A (`web`): root directory `apps/web`
- Service B (`api`): root directory `apps/api`
- Service C (`edge-fastapi`): root directory `apps/edge-fastapi` (optional/private)

Use path filters in CI/CD so each service deploys only when its own folder changes.

Example trigger mapping:

- changes in `apps/web/**` -> deploy web
- changes in `apps/api/**` -> deploy api
- changes in `apps/edge-fastapi/**` -> deploy edge
- shared changes (`package-lock.json`, shared schemas, root scripts) -> deploy affected services

## Recommended hosting topology

For startup speed and fewer moving parts:

- `web` public
- `api` public
- `edge-fastapi` private/internal (optional in email-first beta)
- Postgres + Redis private

See:

- [Architecture](/d:/Convo/fullstack/MASTER_SYSTEM_ARCHITECTURE.md)
- [Hosting plan](/d:/Convo/fullstack/hosting-plan.md)
- [Simple repo tree](/d:/Convo/fullstack/docs/SIMPLE_REPO_TREE.md)
