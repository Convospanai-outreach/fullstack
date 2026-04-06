# Agent Notes (Repo Working Agreement)

This repo is a monorepo with multiple deployable apps. Treat each app as a separate service.

## What runs where

- `apps/web` — Next.js web app (UI + Next route handlers)
- `apps/api` — Fastify API (loads Next-style `routes/**/route.ts` handlers via an adapter)
- `apps/edge-fastapi` — optional private edge runtime
- Shared packages live in `packages/*`

## Local dev quick path

- Start Postgres + Redis + Web + API: `npm run beta:start`
- Start Postgres + Redis + Web + API + Edge: `npm run beta:start:all`

## Prisma + Redis expectations

- Postgres is required for real app functionality (auth, data, workflows).
- Redis is optional for cache/queue features; the app should boot without Redis.
- In CI/build-only environments, avoid hard requirements on Redis/Postgres unless the workflow explicitly provisions them.

## CI / GitHub Actions

- If a workflow needs Postgres/Redis, use GitHub Actions `services:` containers and run `prisma db push` (ephemeral DB) before tests/build steps.
- Defaulting to `redis://localhost:6379` is fine for local dev, but must not cause CI failures when Redis is not provisioned.

## Editing guidance

- Keep changes scoped to the app you’re touching (`apps/web` vs `apps/api`).
- Prefer graceful degradation for optional infra (Redis) and fail-fast for required infra (`DATABASE_URL` in production/runtime).
