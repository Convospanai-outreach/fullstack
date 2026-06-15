# Production Deployment Checklist

Last verified: 2026-06-15

This checklist is for controlled production smoke deployment. It does not certify full commercial launch readiness for optional providers that have not been configured and tested live.

## Build Status

The web production build has been verified locally as passing, but it is longer than a 15 minute deployment timeout.

Observed clean local build:

- Compile: about 8.6 minutes
- TypeScript: about 4.0 minutes
- Static pages: 125/125 in about 71 seconds
- Total clean build: about 19.26 minutes

Deployment requirement:

- Set Railway, Vercel, and CI build timeout to at least 30 minutes.
- A 15 minute timeout can incorrectly report the build as failed even when the build would pass.

The production build now externalizes server-only database runtime packages from the Next server bundle:

- `@prisma/client`
- `@prisma/adapter-pg`
- `pg`

These are server-side packages and must not be imported by client components.

## Runtime Versions And Commands

Use the Node version from `.nvmrc`:

- Node: `22`

Workspace commands:

```bash
npm run typecheck --workspace=craftmyfunnel-full-scaffold
npm run lint --workspace=craftmyfunnel-full-scaffold
npm run build --workspace=craftmyfunnel-full-scaffold
npm run start --workspace=craftmyfunnel-full-scaffold
```

Recommended platform build timeout:

- Minimum: 25 minutes
- Preferred: 30 minutes

## Required Environment

Base production deploy:

- `NODE_ENV=production`
- `DATABASE_URL`
- `DIRECT_URL`

Auth, depending on active path:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

Do not hardcode secrets in the extension, frontend, repository, or build logs.

## Database And Supabase

Supabase is used only as hosted PostgreSQL. Prisma remains the database access layer. Do not add Supabase Auth as part of this deployment path.

Connection guidance:

- `DATABASE_URL` should use the pooled Supabase connection for runtime when appropriate.
- `DIRECT_URL` should use the direct Supabase Postgres connection for migrations.

Safe production commands:

```bash
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
```

Never run this against production:

```bash
npx prisma migrate reset
```

Latest migration to verify:

- `20260614173000_add_llm_usage_actor`

Manual verification step if local production DB access is not available:

1. In Railway or the migration runner, run `npx prisma migrate status`.
2. Confirm `20260614173000_add_llm_usage_actor` is applied.
3. Confirm the `LLMUsageLog.actorId` column exists.
4. If pending, run `npx prisma migrate deploy`.

## Optional Integrations

Missing optional credentials must not block build. Optional providers should remain disabled or return controlled setup-required responses until configured.

Recommended disabled defaults:

```bash
WHATSAPP_ENABLED=false
BILLING_ENABLED=false
NETJANA_ENABLED=false
EDGE_RUNTIME_ENABLED=false
CONTENT_ASSETS_ENABLED=false
EXTENSION_GATEWAY_ENABLED=false
CRM_ENRICHMENT_ENABLED=false
```

Do not enable these integrations for smoke deployment unless credentials, webhook URLs, and provider test flows are ready.

## Scheduled Technical Debt

`npm audit --audit-level=high` currently passes. Moderate transitive findings remain and should be handled in a scheduled dependency upgrade cycle, not forced during smoke deployment:

- `@hono/node-server` through Prisma dev tooling
- `postcss` through Next
- `uuid` through NextAuth

Do not use `npm audit fix --force` in this stabilization pass because the suggested fixes require breaking major changes.

## Reduce Web Production Build Time Below 15 Minutes

This is a follow-up optimization track and is not a blocker for controlled smoke deployment if platform timeout is set to 30 minutes.

Likely optimization areas:

- Reduce static page count or unnecessary static generation.
- Convert DB/auth-heavy routes to dynamic runtime where appropriate.
- Dynamically import heavy browser-only libraries such as `three`, `@react-three/fiber`, `grapesjs`, `puppeteer`, `playwright`, and `pptxgenjs`.
- Analyze bundle size and route compilation hotspots.
- Split admin and experimental surfaces if they are not required in the primary web deployment.
- Cache Prisma generation and dependencies in CI.
- Consider separate deployment boundaries for API and web if build time remains high.
