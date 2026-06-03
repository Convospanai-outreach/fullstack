# Agent Notes (Repo Working Agreement)

This repo is a monorepo with multiple deployable apps. Treat each app as a separate service.

## What Runs Where

- `apps/web` - Next.js web app (UI plus selected route handlers)
- `apps/api` - Fastify API (loads Next-style `routes/**/route.ts` handlers via an adapter)
- `apps/edge-fastapi` - optional private edge runtime
- shared packages live in `packages/*`

## Local Dev Quick Path

- Start Postgres + Redis + Web + API: `npm run beta:start`
- Start Postgres + Redis + Web + API + Edge: `npm run beta:start:all`

## Prisma And Redis Expectations

- Postgres is required for real app functionality: auth, data, workflows, readiness checks.
- Redis is optional for cache/queue features; the app should boot without Redis.
- In CI and build-only environments, avoid hard requirements on Redis/Postgres unless the workflow explicitly provisions them.

## CI / GitHub Actions

- If a workflow needs Postgres/Redis, use GitHub Actions `services:` containers and run the required Prisma setup before tests/build steps.
- Defaulting to `redis://localhost:6379` is fine for local dev, but must not cause CI failures when Redis is not provisioned.
- Do not treat a local pass as the final truth for launch readiness until GitHub Actions is green on the target branch.

## Editing Guidance

- Keep changes scoped to the app you are touching (`apps/web` vs `apps/api` vs `apps/edge-fastapi`).
- Prefer graceful degradation for optional infra (Redis) and fail-fast for required infra (`DATABASE_URL` in production/runtime).
- Do not silently preserve stale docs if the runtime shape changed; update the matching docs in the same run when possible.

## AI Guardrail And Credit Notes

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

## Documentation Sync Rules

When the repo is reassessed, or when runtime boundaries change, update these together:

1. `README.md`
2. `MASTER_SYSTEM_ARCHITECTURE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/README.md`
5. `docs/context/ARCHITECTURE.md`
6. `docs/context/LAUNCH_READINESS.md`
7. the latest readiness assessment document in `docs/`

If an older doc reflects a prior architecture, either update it or clearly mark it as historical/planning-only.

## Repo-Wide Reassessment Workflow

For "reassess the entire app" requests:

1. confirm deployable services and shared packages
2. verify at least one readiness/runtime command per critical service
3. check whether the current docs match the actual repo shape
4. separate API readiness from overall launch readiness
5. call out blockers with evidence, not optimism

Minimum useful commands:

- `npm run readiness:audit --workspace apps/api`
- `npm run lint --workspace apps/web`
- `npm run test:coverage --workspace apps/web`
- `npm run test:e2e --workspace apps/web -- e2e/auth.spec.ts e2e/dashboard.spec.ts`

# AI Agent Scope Rules For Positioning And UI Copy Changes

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

## Token Budget Rules For AI Agents

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

Most important rule:

Use Antigravity like this:

Find files -> stop.  
Patch one surface -> stop.  
Verify banned phrases -> stop.

Do not ask for a full-app analysis and architecture rewrite unless the user explicitly asked for that breadth.

## Multi-Agent Review Workflow

Project goal:
Review and improve this application for security, customer experience, usability, reliability, and performance.

Rules for all review agents:

- Do not make assumptions without checking the code.
- Do not change business logic unless clearly required.
- Every issue must include file name, problem, impact, suggested fix, and priority: Critical / High / Medium / Low.
- Prefer small, reviewable changes.
- Do not expose secrets, tokens, credentials, or private user data.
- Do not delete working features.
- Keep review agents read-only unless explicitly assigned an implementation task.
- Do not allow agents to overwrite each other's work; use separate branches, workspaces, or read-only report outputs when possible.

Recommended initial review agents:

- Builder Agent: app structure, main flows, broken or incomplete areas, obvious bugs, and proposed files to modify before editing.
- Security Review Agent: authentication, authorization, exposed routes, input validation, injection risks, XSS, CSRF, uploads, secrets, env misuse, admin routes, rate limits, and data leakage.
- Customer Experience and Usability Agent: first-time customer journey, homepage clarity, value proposition, CTAs, forms, messaging, mobile flow, navigation, accessibility basics, loading, empty, and error states.
- QA Agent: smoke, functional, validation, mobile, security-related, negative, and edge-case test plan, plus missing tests and critical automation gaps.

Consolidation model:

- Product Manager Agent removes duplicates, prioritizes by business impact, and divides work into Must fix before launch, Should fix soon, and Good to have.
- Developer-ready tasks should include owner: Codex Builder, Security, UX, QA, or Performance.
