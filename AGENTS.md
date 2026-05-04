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

## Product Claim Guardrails

- Public UI and docs must not imply guaranteed qualified meetings, guaranteed pipeline outcomes, fully autonomous outreach, or outcome-based billing unless the workflow is implemented and verified.
- Prefer review-safe language: "helps teams manage", "supports", "prepares", "tracks", "review-ready", "human approval", and "lead and meeting workflow tracking".
- If a feature is only a planning, review, setup, or tracking surface, label it that way. Do not describe it as automatic delivery.
- Keep credit/billing implementation separate from public positioning; do not hide billing logic by renaming data fields.
- Lead status labels should match supported application statuses unless a display-only mapping is clearly safe.

# AI Agent Scope Rules for Positioning and UI Copy Changes

For copy, positioning, or UI messaging tasks:
- Use minimum context.
- Search targeted files only.
- Prefer small patches over broad rewrites.
- Do not inspect the full repo unless necessary.
- Do not modify backend, database, auth, billing, AI runtime, Docker, CI/CD, tests, or package files unless explicitly required.
- Do not add dependencies.
- Do not refactor architecture.
- Do not use broad automated replacements across the repo.
- Before editing, identify the smallest set of files needed.
- After editing, report only files changed and concise summaries.

## Token Budget Rules for AI Agents

For positioning, copy, UX, and UI-label tasks:
- Use minimum context.
- Do not scan the full repository.
- Inspect only the smallest likely set of files.
- Do not open more than 8 files before patching unless explicitly approved.
- Do not edit more than 3 files per run unless explicitly approved.
- Prefer small patches over broad rewrites.
- Do not touch backend, database, Prisma, Docker, CI/CD, auth, billing, package files, or tests unless explicitly required.
- Do not add dependencies.
- Do not refactor architecture.
- Do not use subagents or parallel agents unless explicitly requested.
- Before editing, list the exact files to inspect.
- After editing, report only files changed and concise summaries.
Most important rule

Use Antigravity like this:

Find files → stop.
Patch one surface → stop.
Verify banned phrases → stop.

Do not ask:

Analyze the full app and implement the architecture changes.
