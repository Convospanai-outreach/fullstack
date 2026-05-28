# Landing Agent Discovery

## Goal
Implement a constrained landing-page funnel flow in CraftMyFunnel without changing existing `/campaigns/*` outreach flows.

## Existing Reusable Patterns
- API route loading is file-system based through `apps/api/routes/**/route.ts`.
- Auth and workspace enforcement patterns exist via `getCurrentContext`, `authorizeRole`, and `APIError` helpers.
- Public and authenticated rate limiting already runs in `apps/web/src/proxy.ts`.
- Team-scoped event persistence and audit patterns exist through `SystemEvent`, `EventStore`, and governance audit helpers.
- Existing upload path supports PDF ingestion into Knowledge Items (`/upload/pdf`) which can seed landing assets.

## Key Insertion Points
- New schema entities live in both Prisma schemas:
  - `apps/api/prisma/schema.prisma`
  - `apps/web/prisma/schema.prisma`
- Landing API endpoints live under:
  - `apps/api/routes/landing-agent/**/route.ts`
- Landing orchestration logic lives under:
  - `apps/api/src/modules/landing-agent/*`
- Dashboard and public pages live under:
  - `apps/web/src/app/(dashboard)/landing-agent/**`
  - `apps/web/src/app/p/[slug]/**`
- Public route allowlisting and API public ingress are updated in:
  - `apps/web/src/proxy.ts`

## Risks and Mitigations
- Route collision with existing campaign wizard:
  - Mitigated by dedicated `/landing-agent/*` dashboard namespace.
- Public route auth blocking:
  - Mitigated by adding `/p` and `/p/*` public checks in proxy.
- Anonymous event/lead abuse:
  - Mitigated with existing public rate limiting + honeypot checks + input validation.
- Cross-app Prisma drift:
  - Mitigated by mirroring new landing models in both app schemas.
