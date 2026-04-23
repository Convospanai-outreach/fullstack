# Repository Structure

ConvoSpan is a monorepo with multiple deployable applications. The repository root is for orchestration, shared configuration, documentation, and CI.

## Top-Level Layout

```text
fullstack/
|-- apps/
|   |-- web/                 # Next.js web app
|   |-- api/                 # Fastify API service
|   |-- edge-fastapi/        # Optional private FastAPI edge runtime
|   |-- docker-compose.split.yml
|   |-- README.md
|
|-- packages/                # Shared packages and cross-app contracts
|-- docs/                    # Architecture, runbooks, setup, and product notes
|-- scripts/                 # Root orchestration scripts
|-- docker/                  # Docker support assets
|-- database/                # Database support files
|-- db/                      # Legacy or shared database assets
|-- .github/                 # GitHub Actions workflows
|
|-- docker-compose.yml       # Local Postgres, Redis, web, API, and support services
|-- MASTER_SYSTEM_ARCHITECTURE.md
|-- README.md
|-- package.json             # npm workspace scripts
|-- package-lock.json
```

## Deployable Apps

| App | Path | Runtime | Deployment role |
| --- | --- | --- | --- |
| Web | `apps/web` | Next.js | Public website, dashboard, setup UI, public landing pages |
| API | `apps/api` | Node.js + Fastify | Public backend API, workers, Prisma access, route adapter |
| Edge | `apps/edge-fastapi` | Python + FastAPI | Optional private edge execution runtime |

## Web App Structure

```text
apps/web/
|-- src/
|   |-- app/                 # Next.js App Router pages and route handlers
|   |   |-- (dashboard)/     # Authenticated dashboard routes
|   |   |-- (marketing)/     # Public marketing routes
|   |   |-- api/             # Web route handlers and API proxy
|   |   |-- p/               # Published landing pages
|   |
|   |-- components/          # React components and UI primitives
|   |-- modules/             # Frontend feature modules and service clients
|   |-- lib/                 # Web utilities, auth helpers, flags, rate limits
|
|-- prisma/                  # Web-side Prisma schema mirror
|-- e2e/                     # Playwright tests
|-- tests/                   # Unit and integration tests
|-- scripts/                 # Web build/start helpers
```

## API App Structure

```text
apps/api/
|-- routes/                  # Filesystem-loaded route handlers
|   |-- landing-agent/       # Landing Agent campaign and public endpoints
|   |-- setup/               # Setup wizard endpoints
|   |-- health/              # Health checks
|
|-- src/
|   |-- lib/                 # Auth, DB, governance, integrations
|   |-- modules/             # API domain modules
|   |   |-- landing-agent/   # Landing Agent service, schemas, prompts, adapters
|   |-- workers/             # Background workers
|
|-- prisma/                  # API-owned Prisma schema
|-- server.ts                # Fastify server and Next-style route adapter
```

## Documentation Structure

```text
docs/
|-- README.md                         # Documentation index
|-- architecture-diagram.md           # Mermaid architecture diagrams
|-- landing-agent-architecture.md     # Landing Agent system notes
|-- landing-agent-api-examples.md     # Landing Agent API examples
|-- DEPLOYMENT_RUNBOOK.md             # Deployment runbook
|-- CI_VERIFICATION.md                # CI notes
|-- SETUP.md                          # Setup guide
|-- SIMPLE_REPO_TREE.md               # This file
```

## Deployment Mapping

| Changed path | Typical deployment impact |
| --- | --- |
| `apps/web/**` | Deploy web |
| `apps/api/**` | Deploy API |
| `apps/edge-fastapi/**` | Deploy edge runtime |
| `packages/**` | Deploy services that import the changed package |
| `package-lock.json` | Rebuild affected Node services |
| `apps/api/prisma/schema.prisma` | Apply DB schema workflow, deploy API |
| `apps/web/prisma/schema.prisma` | Keep Prisma schema mirror in sync with API schema |
| `docs/**` | Documentation-only change |

