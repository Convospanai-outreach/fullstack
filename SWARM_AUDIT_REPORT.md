# Swarm Audit Report

Date: 2026-04-30
Repository: `d:\Convo\fullstack`

## Scope

This audit used four role agents plus a coordinator pass:

- Frontend starter: start or verify `apps/web`.
- Backend checker: audit `apps/api`, route loading, auth, typecheck/build/test surface.
- User persona: normal user journey through auth, onboarding, dashboard, generators, workflows.
- Admin persona: admin/team-owner journey through settings, governance, SMTP, keys, team management, auditability.

No application code was edited. This report file is the only created artifact.

## Environment And Runtime Status

- Frontend is running at `http://127.0.0.1:3000/`.
- Current frontend command:

```powershell
cd apps/web
$env:PRISMA_CLIENT_ENGINE_TYPE='client'
$env:NEXT_TELEMETRY_DISABLED='1'
node ../../node_modules/next/dist/bin/next dev --hostname 127.0.0.1
```

- Frontend status: `GET /` returned `200`; port `3000` is listening.
- API port `3001` was closed during the user/admin audits.
- Postgres port `5432` was listening, but `apps/web/.env` points `DATABASE_URL` at `localhost:5433/convospan`.
- Redis port `6379` was closed. This is acceptable for boot because Redis is optional by repo agreement.
- Frontend process reported by the frontend agent: parent PID `13528`, child PID `9128`.
- Stop command if needed:

```powershell
taskkill /PID 13528 /T /F
```

## Verification Run

Coordinator verification:

- `npm run typecheck:api` passed.
- `npm run typecheck:web` passed.
- Web typecheck emitted a Node deprecation warning about passing args to a child process with `shell: true`.

Backend agent verification:

- `npm run typecheck --workspace apps/api` passed.
- `npm run build --workspace apps/api` passed, but see P0 finding about narrow TypeScript coverage.
- `npm test --workspace apps/api` failed before tests due temp directory permissions under `C:\WINDOWS\TEMP`.
- Rerun with repo env wrapper executed tests but failed: 8 failed, 4 passed.
- `npx tsc -p apps/api/tsconfig.json --noEmit` timed out after 240 seconds.
- `npm run preflight:runtime-files` passed.

Browser/persona note: Playwright CLI and `npx` were available, but the user/admin persona agents did their audits before the frontend server was listening, so those passes were static route/UI audits rather than full browser E2E sessions.

## Executive Summary

The repository compiles in the checked paths and the web marketing surface can boot. The main risks are not syntax-level problems; they are runtime integration, authorization boundaries, and incomplete validation coverage.

Highest priority themes:

- `apps/api` Fastify route adaptation is not equivalent to Next runtime behavior for auth/session/cookies.
- Current API typecheck/build scripts can pass while excluding much of the route surface that is loaded at runtime.
- Several sensitive admin/governance/team routes are under-authorized or mutation scopes are not constrained to the current team.
- User-facing generation routes do not consistently preserve the required `402` for insufficient credits and `400` for blocked or oversized prompt input.
- Frontend protected pages and workflows can present logged-out or failed API states as normal empty states.

## P0 Findings

### P0-1 Fastify Adapter Breaks Next/Auth Assumptions

`apps/api/server.ts` adapts Fastify requests into plain Web `Request` objects, while many routes call `getServerSession(authOptions)` or `getCurrentContext()` without passing request context. `getCurrentContext()` relies on `cookies()` from `next/headers`, which expects a Next request context rather than the Fastify adapter context.

Impact:

- Valid authenticated API users can be rejected.
- Team context can be missing or incorrect.
- Protected routes can throw or behave differently under `apps/api` than under Next.

References:

- `apps/api/server.ts:87`
- `apps/api/server.ts:103`
- `apps/api/src/lib/auth.ts:213`
- `apps/api/src/lib/auth.ts:224`
- Request-aware helper exists at `apps/api/src/lib/auth.ts:282`, but is not broadly used.

Recommended fix:

- Standardize API routes loaded by Fastify on request-aware auth/context helpers.
- Add adapter tests for representative protected routes, including cookie/session/team resolution.

### P0-2 NextAuth Catch-All Route Does Not Register Correctly In Fastify

The `routes/auth/[...nextauth]/route.ts` path is converted to `/auth/:...nextauth`, which does not match routes such as `/auth/session` or `/auth/callback/google` in Fastify. Backend agent verified both returned `404` in a minimal Fastify inject check.

Impact:

- API-hosted NextAuth endpoints are effectively unavailable through `apps/api`.

References:

- `apps/api/server.ts:204`
- `apps/api/routes/auth/[...nextauth]/route.ts:1`

Recommended fix:

- Implement explicit catch-all conversion for Next-style `[...param]` segments in the Fastify adapter.
- Add route registration tests for static, dynamic, and catch-all paths.

### P0-3 API Build And Typecheck Are False Positives For Route Safety

`apps/api/package.json` uses `tsc -p tsconfig.strict.json`, but that config includes only a narrow set of files and excludes many runtime-loaded routes and modules. Passing build/typecheck does not prove the Fastify-loaded route surface compiles safely.

Impact:

- CI can pass while route files contain type or runtime import errors.
- Route regressions may only appear after deployment or during manual runtime checks.

References:

- `apps/api/package.json:8`
- `apps/api/tsconfig.strict.json:3`
- `apps/api/tsconfig.strict.json:12`

Recommended fix:

- Add a route-aware typecheck job for `routes/**` and adapter-loaded API modules.
- Keep strict targeted checks if useful, but do not use them as the only build gate.

### P0-4 Cross-Team Team Member Mutation Is Possible If A Member Id Is Known

`PATCH /team/members/[memberId]` and `DELETE /team/members/[memberId]` authorize the caller against their current team, but the service mutates by `memberId` only. The `teamId` boundary is not enforced in the update/delete lookup.

Impact:

- A user with admin rights in one team may mutate or remove a member record in another team if they know the member id.

References:

- `apps/api/routes/team/members/[memberId]/route.ts:17`
- `apps/api/routes/team/members/[memberId]/route.ts:34`
- `apps/api/src/modules/team/service/teamService.ts:43`
- `apps/api/src/modules/team/service/teamService.ts:60`

Recommended fix:

- Change update/delete queries to require both `id` and `teamId`.
- Add tests for cross-team member id attempts returning `404` or `403`.

### P0-5 Legacy Governance Routes Lack Elevated Role Enforcement

Legacy `/governance/*` sensitive routes require authentication but not elevated team role. The admin agent found routes that can create API keys with write scopes, update guardrails, read audit logs, and enumerate members without the elevated checks required by the repo working agreement.

Impact:

- Regular authenticated team members may access or mutate sensitive governance state.

References:

- `apps/api/routes/governance/keys/route.ts:53`
- `apps/api/routes/governance/keys/route.ts:79`
- `apps/api/routes/governance/guardrails/route.ts:47`
- `apps/api/routes/governance/audit/route.ts:8`
- `apps/api/routes/governance/members/route.ts:7`

Recommended fix:

- Require explicit elevated permissions for each sensitive route, using `authorizePermission` or a consistent team-role helper.
- Decide whether legacy `/governance/*` routes should redirect, proxy, or be removed in favor of `/settings/*`.

### P0-6 Protected Web Pages Can Render For Logged-Out Users

The user persona found no web middleware/auth gate for protected app pages, and the dashboard shell is client-rendered. A logged-out user may see dashboard chrome and fallback user state before API calls fail.

Impact:

- Confusing user experience.
- Potential exposure of client-rendered navigation, labels, and stale/local state.
- Auth failures can look like empty product state instead of requiring login.

References:

- `apps/web/src/app/(dashboard)/layout.tsx:22`
- `apps/web/src/components/dashboard/DashboardSidebar.tsx:64`

Recommended fix:

- Add server-side auth guards for protected route groups.
- Ensure logged-out users redirect to login before dashboard UI renders.

### P0-7 Generator Credit And Prompt-Policy Failures Are Inconsistent

Some generation endpoints correctly map insufficient credits to `402` and blocked/oversized prompts to `400`, but others return generic `500` responses. The ICP agent route catches generation errors generically, and `BaseAgent` calls `aiService.askAI` with `disableGuardrails: true`.

Impact:

- Violates the working agreement for user-facing generator routes.
- Users may receive generic failure states instead of actionable credit or prompt-policy messages.
- Guardrail behavior is inconsistent across generation surfaces.

References:

- `apps/api/routes/agents/icp/route.ts:50`
- `apps/api/src/lib/ai/BaseAgent.ts:40`
- `apps/api/src/lib/apiResponse.ts:34`
- Good pattern example: `apps/api/routes/email/compose/route.ts:39`

Recommended fix:

- Centralize generator error mapping and reuse it across all AI routes.
- Avoid `disableGuardrails: true` for user-facing generation unless there is a documented, tested exception.

## P1 Findings

### P1-1 API Route Tests Are Red And Default Test Script Is CI-Hostile

The default API test command failed before executing tests due temp directory permissions. The wrapper command with `TEMP=./tmp TMP=./tmp` ran tests but failed 8 of 12.

References:

- `apps/api/vitest.config.ts:5`
- `apps/api/routes/extension/push/route.ts:55`
- `apps/api/src/linkedin/scraper-bridge.ts:86`
- `apps/api/routes/queue/pending/route.ts:82`
- `apps/api/routes/queue/result/route.ts:100`

Recommended fix:

- Update `apps/api` test script to use repo-local temp dirs like `apps/web` already does.
- Fix or update the failing route tests before trusting the route layer.

### P1-2 API Imports Next Without Declaring `next` In `apps/api`

`apps/api` imports `next/server` and `next/headers`, but `apps/api/package.json` does not declare `next` as a dependency. This can work locally through monorepo hoisting, but fail in an isolated API install or Docker image.

References:

- `apps/api/package.json:42`
- `apps/api/src/lib/auth.ts:2`
- `apps/api/Dockerfile:10`

Recommended fix:

- Either declare `next` in `apps/api` or remove Next runtime dependencies from the Fastify service boundary.

### P1-3 Team Admins Can Invite Arbitrary Roles

`POST /team/members` checks `ADMIN+`, accepts `role` directly from JSON, and writes it without enum validation or owner-only promotion rules.

Impact:

- A team admin may invite a user as owner or another elevated role.

References:

- `apps/api/routes/team/members/route.ts:23`
- `apps/api/routes/team/members/route.ts:27`
- `apps/api/routes/team/members/route.ts:35`

Recommended fix:

- Validate role against allowed enum values.
- Restrict owner/admin role assignment to owner or system-level paths.

### P1-4 AI Agent Settings Can Be Changed By Any Authenticated Team Member

`POST /settings/agent` only checks that a team context exists before upserting agent memory/config. This is a sensitive AI behavior surface and should require elevated team role.

References:

- `apps/api/routes/settings/agent/route.ts:20`
- `apps/api/routes/settings/agent/route.ts:37`

Recommended fix:

- Require admin or an explicit `MANAGE_POLICY`/AI-config permission.

### P1-5 Org Admins Can Grant System Admin Privileges

`checkAdmin()` treats both `SYSTEM_ADMIN` and `ORG_ADMIN` as admin-capable, and `/admin/users` allows arbitrary `enterpriseRole` updates, including `SYSTEM_ADMIN`, without visible extra guardrails.

References:

- `apps/api/src/lib/admin.ts:16`
- `apps/api/routes/admin/users/route.ts:93`

Recommended fix:

- Separate org-admin and system-admin permissions.
- Add self-protection, escalation restrictions, and audit events for role changes.

### P1-6 Sensitive Mutations Lack Audit Coverage

Sensitive mutations such as API key create/delete, SMTP save/delete, webhook secret rotation, admin AI config, and admin user role changes do not consistently record audit events.

References:

- `apps/api/routes/settings/keys/route.ts:40`
- `apps/api/routes/smtp/config/route.ts:41`
- `apps/api/routes/settings/webhooks/route.ts:32`
- `apps/api/routes/settings/webhooks/secret/route.ts:21`
- `apps/api/routes/admin/ai-config/route.ts:97`
- Audit helper: `apps/api/src/lib/governance/audit.ts:12`

Recommended fix:

- Define a required audit helper for sensitive mutations and enforce it in route tests.

### P1-7 Workflow Journey Hides Auth/API Failures

`/workflows` treats non-array responses, including `401`, as an empty workflow list. Create workflow parses responses without checking `res.ok`, which can navigate to `/workflows/undefined`. The editor also ignores saved initial edges.

References:

- `apps/web/src/app/(dashboard)/workflows/page.tsx:22`
- `apps/web/src/modules/workflow/components/WorkflowEditor.tsx:39`

Recommended fix:

- Check `res.ok` before parsing and render auth/error states explicitly.
- Preserve and render existing workflow edges.

### P1-8 Signup Verification Journey Is Contradictory

The API tells users to verify email, while the UI immediately signs them in and routes to `/dashboard`. Auth does not appear to block unverified users.

References:

- `apps/api/routes/register/route.ts:88`
- `apps/web/src/app/(marketing)/signup/page.tsx:105`

Recommended fix:

- Decide whether email verification is required before app access.
- Align API response, UI copy, and auth enforcement.

## P2 Findings

### P2-1 Some Sensitive Read Routes Are Too Permissive

Full SMTP config requires `TeamRole.ADMIN`, but redacted SMTP config only checks that a team exists. API key listing allows `TeamRole.MEMBER`, while key routes are sensitive by the repo working agreement.

References:

- `apps/api/routes/smtp/config/route.ts:20`
- `apps/api/routes/smtp/config/redacted/route.ts:6`
- `apps/api/routes/settings/keys/route.ts:11`

### P2-2 Worker AI Calls Sometimes Omit Team Billing Context

`aiService` implements guardrails, usage logging, and reserve/settle credit handling. Some worker handlers call it without team context, so chargeable team jobs can miss billing attribution.

References:

- `apps/api/src/lib/aiService.ts:186`
- `apps/api/src/lib/aiService.ts:203`
- `apps/api/src/lib/aiService.ts:467`
- `apps/api/src/workers/handlers/sequenceHandlers.ts:53`
- `apps/api/src/workers/handlers/sequenceHandlers.ts:66`
- `apps/api/src/workers/handlers/aiHandlers.ts:21`

### P2-3 Admin UX Is Not Role-Aware Enough

Settings navigation exposes sensitive pages broadly, and command palette actions are exposed client-side to every user. Backend checks block some actions, but the UI invites unauthorized operations.

References:

- `apps/web/src/app/settings/layout.tsx:10`
- `apps/web/src/components/ui/CommandPalette.tsx:22`
- `apps/web/src/components/ui/CommandPalette.tsx:81`

### P2-4 Team Role UI Contract Appears Broken

`/team/members` returns a raw array, but `useTeamRole` and the settings team page expect `{ success, data }`. Owner/admin controls may not render reliably.

References:

- `apps/api/routes/team/members/route.ts:15`
- `apps/web/src/hooks/useTeamRole.ts:28`
- `apps/web/src/app/settings/team/page.tsx:47`

### P2-5 Onboarding Answers Are Not Persisted Or Used

`/onboarding` collects role, company, size, and goals, then routes to `/setup` without persisting the answers or feeding them into setup/checklist progress.

References:

- `apps/web/src/app/onboarding/page.tsx:52`
- `apps/web/src/modules/onboarding/service/onboardingService.ts:5`

### P2-6 OAuth/SSO Entry Points Can Appear When Unusable

Google and SSO options are displayed without clear configuration gating. If env credentials are placeholders or providers are not configured, users may encounter provider errors instead of a disabled or explanatory state.

References:

- `apps/web/src/app/(marketing)/login/page.tsx:197`
- `apps/web/src/lib/auth.ts:13`

## Positive Notes

- `apps/api/src/lib/aiService.ts` does centralize most AI provider usage, prompt guardrails, credit reservation/settlement, usage logging, and embedding billing.
- Several user-facing AI routes already map insufficient credits to `402` and prompt-policy failures to `400`; these should become the shared pattern.
- Redis absence did not prevent the frontend from booting.
- Web and API targeted typechecks passed.
- The frontend marketing/root surface is reachable locally at `http://127.0.0.1:3000/`.

## Recommended Remediation Order

1. Fix the Fastify adapter auth/context and catch-all route registration issues.
2. Expand API build/typecheck coverage so `routes/**` is part of CI.
3. Close P0 authorization gaps in team member mutation and legacy governance routes.
4. Normalize generator error handling to preserve `402` and `400` contract semantics.
5. Add server-side web auth guards for protected app route groups.
6. Repair API route tests and make the default test script use repo-local temp directories.
7. Add audit logging for sensitive settings, key, SMTP, webhook, and admin role mutations.
8. Align frontend UX with backend auth/role/verification state.

## Residual Risk

This audit did not run a full authenticated browser E2E pass because API port `3001` was not running and the configured Postgres URL did not match the listening local Postgres port. External services such as AI providers, SMTP, Razorpay, Redis queues, OAuth providers, and production database migrations were not exercised.
