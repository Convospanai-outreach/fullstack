# ConvoSpan Platform Monorepo

This repository is an orchestration monorepo. Production apps live under `apps/*`.

## Source Of Truth

- Web frontend: `apps/web`
- API service: `apps/api`
- Edge FastAPI service: `apps/edge-fastapi`

Root is not a deployable application.

## Local Build Commands

```bash
npm run build:web
npm run build:api
```

## Deployment Targets

- Web -> Vercel (`apps/web`)
- API -> Docker on DigitalOcean (`apps/api`)
- Edge -> Docker on DigitalOcean (`apps/edge-fastapi`, when enabled)
