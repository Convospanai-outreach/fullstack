# CraftMyFunnel Architecture

## Executive Summary

CraftMyFunnel is a monorepo with a public web app, a public API, and an optional private edge runtime. The current launch path is **web + API + Postgres**, with Redis recommended and edge optional.

This document is intentionally grounded in the current repo, not in older planned topologies.

## Services

| Service | Path | Purpose | Required for launch |
| --- | --- | --- | --- |
| Web | `apps/web` | Marketing, dashboard, setup, public landing pages, some route handlers | Yes |
| API | `apps/api` | Business APIs, workers, Prisma, webhooks, AI runtime path, readiness checks | Yes |
| Edge | `apps/edge-fastapi` | Private edge execution and hardware-adjacent work | No |
| Shared package | `packages/toon-core` | Shared AI/context utilities | Indirectly |

## Runtime Layers

### 1. Experience layer

Owned by `apps/web`.

- marketing pages
- signed-in product UI
- setup and launch configuration
- public landing pages
- browser-facing auth/session handling

### 2. API and workflow layer

Owned by `apps/api`.

- route handlers
- Fastify server bootstrap
- team-aware mutations
- worker dispatch
- webhook intake
- readiness and observability endpoints

### 3. Domain layer

Key module groups inside `apps/api/src/modules` include:

- campaigns and outreach
- landing-agent
- intel/signals
- governance and audit
- billing and usage
- knowledge and RAG
- conversation/caller/whatsapp compliance
- settings, onboarding, and team management

### 4. Persistence and infra layer

- Postgres through Prisma
- Redis as optional cache/queue support
- external providers for LLMs, SMTP, CRM, and billing

## Current Request Patterns

### Web -> API

Most business operations should cross the service boundary into `apps/api`, even when initiated from `apps/web`.

### Public landing -> API

Public pages render in `apps/web`, but capture, event tracking, and downstream workflow state belong in `apps/api`.

### Webhook -> API

Signal ingestion and operational webhooks terminate at `apps/api`, which owns validation and persistence.

### API -> Edge

Optional private hop. The launch path must still work when edge is absent.

## AI Runtime Contract

The active contract is:

1. input validation
2. prompt and size guardrails
3. estimated credit reservation
4. provider call
5. usage logging
6. credit settlement or refund

Important implementation notes:

- AI generation should go through `apps/api/src/lib/aiService.ts`
- guardrails are centralized in `apps/api/src/lib/aiInputGuardrails.ts`
- chargeable team contexts must enforce reservation and settlement in the runtime path

## Security And Governance Posture

Current high-confidence controls:

- role-gated sensitive configuration routes
- team scoping
- audit-log path
- landing HTML sanitization before public render
- readiness endpoints with runtime checks
- optional-infra degradation for Redis

Remaining risk areas:

- dependency vulnerability backlog
- CI confirmation gap after local fixes
- flaky web coverage lane in the current tree

## Launch Readiness Read

### What is ready

- API readiness audit can pass `100/100`
- the service split is clear enough for separate deployment and ownership
- the product has meaningful guardrails around AI and public landing output

### What still needs confidence

- deterministic web unit/coverage execution
- a fresh green GitHub Actions run
- final container-build confirmation on the web image path
- security debt reduction or explicit risk acceptance for remaining high-severity packages

## Source Of Truth

Use these docs together:

- `README.md`
- `MASTER_SYSTEM_ARCHITECTURE.md`
- `docs/PRODUCTION_READINESS_ASSESSMENT_2026-06-02.md`
- `docs/context/ARCHITECTURE.md`
- `docs/context/LAUNCH_READINESS.md`
