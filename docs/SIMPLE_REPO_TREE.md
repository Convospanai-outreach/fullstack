# Simple Repo Tree

```text
fullstack/
|- apps/
|  |- web/                 # Next.js web app (public)
|  |- api/                 # Fastify API app (public)
|  |- edge-fastapi/        # FastAPI edge app (private/optional)
|  |- docker-compose.split.yml
|  |- README.md
|
|- docs/
|  |- v1-beta-scope.md
|  |- SIMPLE_REPO_TREE.md
|
|- scripts/
|  |- start-local-beta.mjs # one-command local bootstrap
|  |- ...other scripts
|
|- docker-compose.yml      # local infra/services
|- hosting-plan.md         # hosting strategy
|- MASTER_SYSTEM_ARCHITECTURE.md
|- README.md
|- package.json            # monorepo workspace scripts
```

## Deploy mapping from one repo

- `apps/web` -> web service
- `apps/api` -> api service
- `apps/edge-fastapi` -> edge service

Each service can deploy independently from this single git repository.
