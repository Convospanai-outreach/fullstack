# Apps Folder

This directory contains the deployable services in the CraftMyFunnel monorepo.

| App | Path | Role | Required |
| --- | --- | --- | --- |
| Web | `apps/web` | Public Next.js UI, dashboard, setup, public landing pages | Yes |
| API | `apps/api` | Public Fastify API, workers, Prisma, webhooks, readiness checks | Yes |
| Edge | `apps/edge-fastapi` | Optional private FastAPI edge runtime | No |

## Deployment Model

Each app deploys independently even though the code lives in one repository.

- web deploy root: `apps/web`
- API deploy root: `apps/api`
- edge deploy root: `apps/edge-fastapi`

## Local Runtime

From the repo root:

```bash
npm run beta:start
```

To include the optional edge runtime:

```bash
npm run beta:start:all
```

## Notes

- Postgres is required for real product behavior.
- Redis is recommended but optional.
- Edge should remain private unless there is a clear product or operational need to expose it.
