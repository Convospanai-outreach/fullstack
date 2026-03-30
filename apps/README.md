# Apps Folder

This directory contains the three deployable applications in this monorepo:

- `web` - Next.js app (public UI)
- `api` - Fastify app (public API)
- `edge-fastapi` - FastAPI app (private optional edge runtime)

## Independent deploy model

Each app is deployed separately, even though they live in one git repository.

- web service uses `apps/web` as its deploy root
- api service uses `apps/api` as its deploy root
- edge service uses `apps/edge-fastapi` as its deploy root

## Why keep them in one repo

- one source of truth for contracts and schemas
- one PR can change all required layers safely
- CI can still deploy services independently using path filters

## Local split runtime

```bash
docker compose -f docker-compose.split.yml up -d
```
