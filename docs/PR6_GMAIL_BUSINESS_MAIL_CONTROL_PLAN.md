# PR6 Gmail Business Mail Control Rebuild Plan

## Current Assessment

PR6 branch: `gmail-business-mail-control`

The branch is currently too broad to merge safely into `main` as-is.

- It is `102` commits behind `main` and `5` commits ahead.
- It changes `58` files across API, web, Prisma, extension code, auth pages, Playwright tests, package locks, and docs.
- It does not contain the newer LinkedIn lead sync migration/models currently on `main`:
  - `LeadChannelStatus`
  - `LeadActivity`
  - `/api/extension/leads/capture`
- It modifies login/signup/auth surfaces that now need to stay Clerk-first.
- It modifies extension files that recently gained the unified CRM lead capture flow.
- It deletes current Clerk sync files, LinkedIn extension lead routes, dashboard funnel routes, and lead-stage transition helpers.

## Merge Decision

Do not merge PR6 directly.

Rebuild it from current `main` as smaller PRs, preserving:

- Clerk as the user signup/login authority.
- Supabase/Postgres as the database layer only.
- Prisma as the ORM.
- Existing LinkedIn extension lead sync and lead activity flow.
- Optional/manual Playwright authenticated checks.

## Safe Split Plan

### PR6A: Gmail Mailbox Data Model

Scope:

- Add Gmail mailbox/account models.
- Add Gmail tracking/drip fields only if they do not overwrite existing lead/channel/activity models.
- Add migrations from current `main`, not from the stale PR6 schema snapshot.

Guardrails:

- Preserve `LeadChannelStatus`.
- Preserve `LeadActivity`.
- Preserve extension capture fields and relations.
- Do not reformat the full Prisma schema unless required by Prisma tooling.

Validation:

- `npx prisma generate --workspace apps/api`
- `npx prisma generate --workspace apps/web`
- Migration review for destructive changes.

### PR6B: Gmail Mailbox Service And Admin Routes

Scope:

- Add mailbox connection, callback, list, and test-send routes.
- Add mailbox encryption helper.
- Add Gmail inbound sync helper.

Guardrails:

- Require existing auth/session/workspace checks.
- Do not expose tokens to the frontend.
- Do not store OAuth secrets in extension code.
- Keep secrets in environment variables only.
- Do not change login/signup pages.

Validation:

- Unit or route-level tests for unauthorized access.
- Manual test with missing Gmail env vars returning a safe setup error.

### PR6C: Email Tracking Routes

Scope:

- Add open, click, and unsubscribe tracking routes.
- Add activity records into the unified lead timeline.

Guardrails:

- Preserve existing `LeadActivity` semantics.
- Keep unsubscribe idempotent.
- Avoid recording sensitive query params in activity notes.
- Rate-limit public tracking endpoints where applicable.

Validation:

- Open/click route smoke tests.
- Unsubscribe route idempotency test.

### PR6D: Drip Intelligence Integration

Scope:

- Add drip preparation endpoint and service.
- Route AI calls through `apps/api/src/lib/aiService.ts`.

Guardrails:

- Apply prompt guardrails through `aiInputGuardrails`.
- Enforce credit reservation/settlement for chargeable team contexts.
- Return `402` for insufficient credits and `400` for blocked or oversized prompts.

Validation:

- Guardrail rejection test.
- Credit failure test.

### PR6E: Web UI Integration

Scope:

- Add Gmail/mailbox setup UI where needed.
- Add campaign/drip UI affordances.
- Add channel badges/timeline display only if they align with existing lead statuses.

Guardrails:

- Do not replace Clerk `SignIn` or `SignUp`.
- Do not reintroduce password signup.
- Do not make Playwright auth tests mandatory without seeded auth state.
- Keep public copy review-safe: no guaranteed pipeline, automatic outreach, or outcome billing claims.

Validation:

- `npm run lint --workspace apps/web`
- `npm run build:web`
- Auth smoke test remains Clerk-based.

### PR6F: Docs And Deployment Configuration

Scope:

- Add Gmail cloud setup docs.
- Add required environment variables to examples.
- Document provider setup for actual deployment targets.

Guardrails:

- Do not claim Gmail integration is production-ready until route tests, env setup, and GitHub Actions pass.
- Keep Supabase language limited to Postgres hosting unless Supabase Auth is intentionally implemented later.

Validation:

- Docs match runtime env names.
- GitHub Actions green on the target branch.

## High-Risk Files From Original PR6

- `apps/web/src/lib/clerkAuth.ts`
- `apps/web/src/app/api/webhooks/clerk/route.ts`
- `apps/web/src/app/api/auth/clerk-sync/route.ts`
- `apps/web/src/app/(marketing)/login/page.tsx`
- `apps/web/src/app/(marketing)/signup/page.tsx`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/proxy.ts`
- `apps/api/src/lib/auth.ts`
- `apps/api/prisma/schema.prisma`
- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/migrations/20260609110000_clerk_user_mapping/migration.sql`
- `apps/api/prisma/migrations/20260612000100_lead_channel_status_activity/migration.sql`
- `apps/web/prisma/migrations/20260612000100_lead_channel_status_activity/migration.sql`
- `apps/api/routes/extension/leads/capture/route.ts`
- `apps/api/routes/extension/leads/[id]/linkedin-contacted/route.ts`
- `apps/api/routes/extension/leads/route.ts`
- `apps/web/src/app/api/extension/[...path]/route.ts`
- `apps/api/src/linkedin/profile-normalizer.ts`
- `apps/api/src/linkedin/extension-bridge.ts`
- `apps/api/routes/extension/action/route.ts`
- `apps/web/src/lib/crm/funnel.ts`
- `apps/web/src/lib/crm/leadStageTransitions.ts`
- `apps/web/src/app/api/dashboard/funnel/route.ts`
- `apps/api/src/extension/background.js`
- `apps/api/src/extension/popup.js`
- `apps/api/src/extension/popup.html`
- `apps/web/package.json`
- `apps/web/.env.example`
- `docs/SUPABASE_POSTGRES_SETUP.md`
- `package-lock.json`

These files should be reapplied manually from `main` with narrow patches, not wholesale from PR6.

## Non-Negotiable Preservation List

Any rebuilt Gmail PR must keep these current `main` decisions intact:

- Clerk remains the signup/login authority.
- `@clerk/nextjs` stays in the web app.
- Clerk webhook and app-user sync routes stay present.
- Supabase remains Postgres hosting only unless a later PR intentionally implements Supabase Auth.
- `docs/SUPABASE_POSTGRES_SETUP.md` stays present and accurate.
- `LeadChannelStatus` and `LeadActivity` stay in both Prisma schemas and migrations.
- LinkedIn extension lead capture/sync routes stay present.
- Extension actions stay user-approved lead workflow actions, not background automation.
- Dashboard funnel and lead-stage transition helpers stay present.
- `npm run lint --workspace apps/web` remains available.

## Recommended Next Action

Start a fresh branch from current `main` for PR6A and manually add only the Gmail mailbox schema/migration changes. Keep auth, extension, and Playwright untouched in the first rebuilt PR.
