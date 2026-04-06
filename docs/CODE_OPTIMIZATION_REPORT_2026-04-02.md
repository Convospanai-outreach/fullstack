# Code Optimization Report (2026-04-02)

## Scope
- Monorepo apps reviewed: `apps/web`, `apps/api`, `apps/edge-fastapi`
- Inputs used: current codebase structure, recent build/smoke runs, route/module layout, TOON integration points

## Current Baseline
- `apps/web` production build completed successfully, with:
  - compile phase about `111s`
  - static generation phase about `40s` for `96` pages
- `apps/api` contains `252` route modules (`routes/**/route.ts`)
- `apps/web/src/app` contains about `100` `page.tsx/page.ts/route.ts` files
- TOON implementation exists in both web and api:
  - `apps/web/src/lib/ai/TOON.ts`
  - `apps/api/src/lib/ai/TOON.ts`
  - both files are same size/date (duplicated logic)

## Why TOON Is Not Visible In UI
TOON is currently a backend/service-layer primitive, not a frontend product surface:
- Used in agent/rag pipelines (example calls):
  - `apps/api/src/modules/agent/core/AgentExecutor.ts`
  - `apps/api/src/modules/rag/service/KnowledgeIngressService.ts`
  - mirrored equivalents in `apps/web/src/modules/...`
- No dedicated UI widget/page currently surfaces TOON stats/state directly.

## Priority Optimizations

### P0 (High Impact, Low Risk)
1. Remove TOON duplication across `apps/web` and `apps/api`
- Problem: same TOON logic duplicated in two apps.
- Action: move TOON into a shared workspace package (for example `packages/ai-core/src/TOON.ts`) and import from both apps.
- Benefit: single source of truth, lower drift risk, easier hardening.

2. Add TOON observability so usage is visible
- Problem: TOON runs but there is no explicit UI/metrics surface.
- Action:
  - emit structured logs from `TOON.process()` (`teamId`, input chars, output chars, token estimate, elapsedMs)
  - persist counters in metrics store (or existing observability pipeline)
  - add admin endpoint/dashboard tile for TOON usage and compression ratio
- Benefit: confirms TOON is active and measurable.

3. Fix API startup scalability bottleneck
- Problem: API boot dynamically imports/registers all routes eagerly (`252` route files), increasing cold-start time.
- Action: load only enabled route groups at boot (feature/namespace-based), or generate static route manifest and lazy bind heavy groups.
- Benefit: faster startup, lower memory spikes.

### P1 (Medium Impact)
4. Web build performance tuning
- Action:
  - keep moving static-heavy routes to ISR/partial prerender when possible
  - audit expensive server components called during build-time data collection
  - keep `optimizePackageImports` and reduce server-only deps pulled into broad module graphs
- Benefit: shorter CI build time and deploy latency.

5. Strengthen health endpoint semantics by environment profile
- Current: non-production/beta mode returns `200 degraded` on DB failure.
- Action: document this clearly in ops runbook and ensure production alerting uses strict profile (`503 unhealthy`).
- Benefit: avoids false-positive healthy signals in production monitoring.

### P2 (Cleanup/Tech Debt)
6. Reduce generated/runtime artifact churn in repo root
- Action: centralize build logs in ignored paths and enforce cleanup task in scripts.
- Benefit: clearer `git status`, easier code review and safer commits.

7. Consolidate AI pipeline modules mirrored in web/api
- Problem: several agent/rag services appear mirrored in both apps.
- Action: move shared logic into workspace package with thin adapters per app.
- Benefit: reduced maintenance cost and fewer behavioral mismatches.

## Suggested 2-Week Execution Plan
1. Week 1:
- Extract TOON to shared package
- Add TOON structured telemetry + admin endpoint
- Add one dashboard card (TOON calls/day, avg compression ratio)

2. Week 2:
- Implement API route-group boot loading
- Profile web build hotspots and optimize top 3 offenders
- Add CI check for generated log/artifact cleanup

## Success Metrics
- TOON visibility:
  - dashboard shows non-zero TOON usage for real agent/rag requests
  - logs include compression + cost estimates per call
- Performance:
  - API boot time reduced by at least 20%
  - Web production build wall-time reduced by at least 15%
- Maintainability:
  - TOON implementation exists in exactly one shared source file
