# Deployment Quick Start (Monorepo)

This repository contains multiple deployable apps:

- `apps/web` (Next.js)
- `apps/api` (Fastify)
- `apps/edge-fastapi` (optional/private)

For a production-first hosting plan, see `hosting-plan.md`.

## Local (Docker infra + Node apps)

Start Postgres + Redis (Docker) and then start/reuse API + Web:

```bash
npm run beta:start
```

## CI / GitHub Actions (Prisma/Redis)

GitHub runners do not include Postgres/Redis. If a workflow needs them:

1. Add workflow `services:` for Postgres/Redis
2. Run `prisma db push` (ephemeral DB) before integration steps

See `.github/workflows/ci.yml` and `.github/workflows/playwright.yml`.

