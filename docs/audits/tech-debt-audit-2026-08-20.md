# Technical Debt Audit — CraftMyFunnel Platform
**Date:** 2026-08-20
**Scope:** Full monorepo (`apps/web`, `apps/api`, `apps/edge-fastapi`, `packages/*`, root tooling/CI/docs)

## Note on existing tracking

This repo already runs an active debt/issue ledger at `OPEN_ITEMS.md` (154KB, 51 items, last reconciled today) plus several historical audit docs (`AGENT_SECURITY_AUDIT.md`, `AUDIT_REMEDIATION_LOG.md`, `COMPREHENSIVE_AUDIT_REPORT_FINAL.md`). This audit does not duplicate that ledger. It cross-checks against it and reports only what's newly surfaced or still unresolved, using the framework below for prioritization.

**Priority = (Impact + Risk) × (6 − Effort)**, each scored 1–5.

## Prioritized findings

| # | Item | Category | Impact | Risk | Effort | Priority | Status |
|---|------|----------|:-:|:-:|:-:|:-:|---|
| 1 | Neon credential rotation still pending (transcript-exposed `neondb_owner` password; blocked Google OAuth secret rotation) | Security | 5 | 5 | 1 | **50** | Tracked (OPEN-21), unresolved |
| 2 | Prisma schema triplicated with no sync tooling (`apps/web/prisma`, `apps/api/prisma`, `packages/db/prisma` — byte-identical, manually kept in sync) | Architecture | 4 | 4 | 2 | **32** | Net-new |
| 3 | Fragmented/stale status docs (`SYSTEM_STATUS.md`, `TEST_STATUS.md`, `PENDING_ITEMS.md`, `QUICK_ACTION_PLAN.md` all 6+ months stale, compete with live `OPEN_ITEMS.md`) | Documentation | 3 | 2 | 1 | **25** | Net-new |
| 4 | 30-entry manual `overrides` block in root `package.json` pinning transitive deps (hand-patched CVEs, no automated tracking of when overrides can be dropped) | Dependency | 3 | 4 | 3 | **21** | Partially tracked (OPEN-30) |
| 5 | `edge-fastapi` requirements drift across 3 manually-maintained files (`requirements.txt`, `.pi.txt`, `.runtime.txt`) with inconsistent model deps | Dependency | 3 | 3 | 3 | **18** | Net-new |
| 6 | Neon preview-branch cleanup not automated — manual deletion of 8–15 stale branches every ~2 weeks | Infrastructure | 2 | 2 | 1 | **20** | Tracked, unresolved |
| 7 | ~260 remaining `any`-typed instances + incomplete `console.log`→structured-logger migration (figures stale, need recount) | Code | 3 | 3 | 4 | **12** | Tracked (stale, needs refresh) |
| 8 | Duplicate Jest configs at root (`jest.config.js` + `jest.config.cjs`, unclear which runs) | Test | 2 | 1 | 1 | **15** | Net-new |
| 9 | No `engines` field anywhere enforcing the `.nvmrc`-pinned Node 22 | Dependency | 1 | 2 | 1 | **15** | Net-new |
| 10 | CI workflow overlap — `ci.yml`, `verify.yml`, `production-gate.yml`, `vercel-parity-build.yml` all touch build/Prisma steps, not confirmed distinct | Infrastructure | 2 | 2 | 3 | **12** | Net-new |
| 11 | Oversized files: `googleMailboxService.ts` (1913 lines), `StrategyWizard.tsx` (1234 lines), `LeadDetail.tsx` (899 lines), `setup/page.tsx` (830 lines) | Code | 3 | 2 | 4 | **10** | Net-new |
| 12 | Root-level scratch script clutter (`check.js`, `check-db.ts`, `boost-readiness.ts`, `.diff`, `.ps1` files) not in `scripts/` | Code | 1 | 1 | 1 | **10** | Net-new |
| 13 | `apps/api` (Fastify/Hono service) depends on `react`/`next` — likely leftover, unverified if used | Dependency | 1 | 1 | 1 | **10** | Net-new |
| 14 | 5 docker-compose variants (base/edge/monitoring/prod/staging) — each appears to target a distinct concern, low true overlap | Infrastructure | 1 | 1 | 2 | **8** | Net-new |
| 15 | Zero-byte junk files at repo root (`({`, `[]`, `[d.id`, `s.d)`) — accidental shell artifacts | Code | 1 | 1 | 1 | **10** | Net-new (cosmetic) |
| 16 | Multiplicity of agent-instruction docs (`AGENTS.md`, `AGENT_RULES.md`, `CLAUDE.md`, `GEMINI.md`) — overlap not diffed | Documentation | 2 | 1 | 2 | **6** | Net-new |

## Phased remediation plan

**Phase 0 — This week, alongside normal work (near-zero effort, high leverage)**
- Finish Neon `neondb_owner` password rotation + Google OAuth secret rotation (#1). Highest-risk open item in the repo.
- Delete the four zero-byte junk files at root (#15).
- Delete one of the two Jest configs, confirm which is actually invoked by `npm test`, update scripts if needed (#8).
- Turn on GitHub "delete branch on merge" and/or Neon's native preview-branch cleanup (#6).
- Add `engines` to root/apps `package.json` matching `.nvmrc` (#9).

**Phase 1 — Next sprint (small, scoped changes)**
- Write a one-line `scripts/sync-prisma-schema.mjs` (or symlink two of the three schema files to one canonical source) to remove the triple-copy failure mode (#2).
- Add a top-of-file banner to `SYSTEM_STATUS.md`, `TEST_STATUS.md`, `PENDING_ITEMS.md`, `QUICK_ACTION_PLAN.md` pointing to `OPEN_ITEMS.md` as canonical, or archive them under `docs/archive/` (#3).
- Consolidate `edge-fastapi` requirements files or generate `.pi.txt`/`.runtime.txt` from `requirements.txt` via a constraints file (#5).
- Move root-level scratch scripts into `scripts/` (#12).
- Confirm whether `apps/api`'s `react`/`next` deps are dead weight and remove if so (#13).

**Phase 2 — Ongoing/opportunistic (larger effort, do alongside feature work)**
- Re-run the `any`-type and `console.log` counts to get current numbers, then chip away during touches to those files rather than a dedicated sprint (#7).
- Diff `ci.yml`/`verify.yml`/`production-gate.yml`/`vercel-parity-build.yml` to confirm distinct purpose; merge or clearly comment the boundary if overlapping (#10).
- Break up the four oversized files (#11) opportunistically when next modified — no need for a standalone refactor sprint.
- Diff `AGENTS.md`/`AGENT_RULES.md`/`CLAUDE.md`/`GEMINI.md` for contradictions, consolidate if agent-tool-specific content can share a common source (#16).

**Not prioritized for action:** docker-compose variant count (#14) — investigation suggests each file targets a genuinely distinct deployment target rather than duplication; revisit only if a new variant is proposed.
