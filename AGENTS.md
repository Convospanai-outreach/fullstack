# Agent Notes (Repo Working Agreement)

This repo is a monorepo with multiple deployable apps. Treat each app as a separate service.

## What runs where

- `apps/web` - Next.js web app (UI + Next route handlers)
- `apps/api` - Fastify API (loads Next-style `routes/**/route.ts` handlers via an adapter)
- `apps/edge-fastapi` - optional private edge runtime
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

- Keep changes scoped to the app you're touching (`apps/web` vs `apps/api`).
- Prefer graceful degradation for optional infra (Redis) and fail-fast for required infra (`DATABASE_URL` in production/runtime).

## AI Guardrail and Credit Notes

- AI generation in `apps/api` should go through `src/lib/aiService.ts` so prompt guardrails and credit enforcement are applied.
- Prompt-policy and size controls are centralized in `src/lib/aiInputGuardrails.ts`.
- For chargeable team contexts, generation must reserve estimated credits and settle actual usage in the runtime path.
- Embedding requests should use the same guarded billing/logging path as text generation.
- Legacy extension queue flows should preserve team scoping and claim-aware result semantics.
- Sensitive config, SMTP, key, policy, and team-management routes should require elevated team roles.
- User-facing generator routes should return `402` on insufficient credits and `400` for blocked/oversized prompt input.
