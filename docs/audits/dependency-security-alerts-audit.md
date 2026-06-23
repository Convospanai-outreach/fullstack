# Dependency Security Alerts Audit

Date: 2026-06-23
Agent: dependency-security-agent
Status: NEEDS_REPLAN
Inspected baseline: `origin/main` at `7fcfff7eee29f7dbc37aa9623faab0c1924c67f7`

## Purpose

Stage 13 adds a dedicated release gate for GitHub Dependabot and npm audit remediation. This stage must run after CI/PR strategy and before DB performance/security hardening or final readiness.

Final readiness must not be marked until high severity production dependency alerts are fixed or explicitly proven unreachable in production. Vercel or Railway deploy status is not production readiness.

## Guardrails

- Do not run `npm audit fix --force`.
- Do not blindly upgrade Prisma, NextAuth, Next.js, Clerk, React, or Prisma adapter packages.
- Do not downgrade production-critical packages to make alerts disappear.
- Prefer targeted direct dependency upgrades, safe transitive `overrides`, or lockfile-only updates.
- Treat high severity production dependency alerts as release blockers unless documented as unreachable in production.
- Moderate alerts may be tracked as follow-up only if not reachable in production and not part of the runtime bundle.
- Do not touch DB schema, migrations, Supabase production data, Redis data, Clerk dashboard settings, Vercel/Railway secrets, or PR #6.

## Current Alert Inventory

Dependency chains below are remediation-stage work items. Each chain must be proven with `npm ls <package> --all --workspaces` or a workspace-specific equivalent before a fix is claimed.

| Alert | Package | Severity | Direct or transitive | Dependency chain | Affected workspace/file | Production runtime reachability | Safe fix strategy | Validation command | Final verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #250 | `ws` | High | Transitive until proven otherwise | Verify with `npm ls ws --all --workspaces`; prior audit evidence indicates Socket.IO/Engine.IO paths may pull `ws` into production dependencies | Root `package-lock.json` | Potentially reachable if WebSocket/Socket.IO paths are deployed in web/API runtime | Prefer a targeted compatible `ws` patch via parent package update or root override; validate Socket.IO compatibility and runtime boot | `npm audit --audit-level=high --omit=dev`; `npm run typecheck:web`; `npm run build:web` | BLOCKER until fixed or proven unreachable |
| #158 | `picomatch` | High | Transitive | Verify with `npm ls picomatch --all --workspaces` | `apps/web/package-lock.json` | Not proven runtime-reachable; likely build/tooling until dependency chain proves otherwise | Prefer a safe patched transitive override or parent tooling update; avoid broad Next.js/React upgrades | `npm audit --audit-level=high --omit=dev`; `npm --workspace apps/web run lint`; `npm run build:web` | BLOCKER until runtime reachability is proven and high gate passes |
| #261 | `nodemailer` | High | Direct in at least one app until verified; also appears in root lockfile | Verify with `npm ls nodemailer --all --workspaces` and inspect app package manifests | Root `package-lock.json` | Potentially reachable in production email-sending flows | Target a patched Nodemailer version compatible with current SMTP/message construction; audit code for `raw`, `disableFileAccess`, and `disableUrlAccess` usage | `npm audit --audit-level=high --omit=dev`; email route typecheck/build; targeted mailer tests if present | BLOCKER until fixed or mail paths are proven unreachable |
| #24 | `brace-expansion` | Moderate | Transitive | Verify with `npm ls brace-expansion --all --workspace apps/api` | `apps/api/package-lock.json` | Not proven runtime-reachable; often glob/tooling related | Prefer patched transitive override or parent package update after chain proof | `npm audit --audit-level=moderate --omit=dev`; `npm run typecheck --workspace apps/api`; `npm run build --workspace apps/api` | FOLLOW-UP allowed only if non-runtime and documented |
| #262, #216, #105 | `uuid` | Moderate | Transitive or direct depending workspace; must verify | Verify with `npm ls uuid --all --workspaces`; prior evidence suggests auth/library paths may include nested versions | Root `package-lock.json`, `apps/web/package-lock.json`, `apps/api/package-lock.json` | Reachability depends on whether vulnerable v3/v5/v6 APIs with `buf` are used by runtime code | Prefer parent dependency patch or semver-compatible override; audit source for `uuid.v3`, `uuid.v5`, `v6`, and `buf` usage | `npm audit --audit-level=moderate --omit=dev`; source search for vulnerable API patterns | FOLLOW-UP only if vulnerable API usage is not runtime reachable |
| #182, #54 | `postcss` | Moderate | Transitive | Verify with `npm ls postcss --all --workspaces`; likely through web/build tooling and framework packages | `apps/web/package-lock.json`, `apps/api/package-lock.json` | Likely build-time, but server-side CSS processing reachability must be checked | Prefer compatible PostCSS patch or parent package patch; do not blindly upgrade Next.js | `npm audit --audit-level=moderate --omit=dev`; `npm run build:web`; API build if chain includes API | FOLLOW-UP only if not runtime-bundled or after compatible patch |
| #161, #160 | `picomatch` | Moderate | Transitive | Verify with `npm ls picomatch --all --workspace apps/web` | `apps/web/package-lock.json` | Not proven runtime-reachable; likely glob/tooling | Same strategy as high `picomatch`: compatible override or parent package patch after chain proof | `npm audit --audit-level=moderate --omit=dev`; `npm --workspace apps/web run lint`; `npm run build:web` | FOLLOW-UP only if non-runtime after high alert is resolved |
| #170, #36 | `@hono/node-server` | Moderate | Transitive until proven otherwise | Verify with `npm ls @hono/node-server --all --workspaces`; prior evidence suggests Prisma tooling paths may include Hono packages | `apps/web/package-lock.json`, `apps/api/package-lock.json` | Not proven app-runtime reachable unless the Hono server package is used by deployed routes | Prefer patched parent/tooling update or compatible override; avoid blind Prisma major upgrades | `npm audit --audit-level=moderate --omit=dev`; Prisma generate/typecheck/build commands | FOLLOW-UP only if tooling-only and documented |
| #255 | `@opentelemetry/core` | Moderate | Transitive | Verify with `npm ls @opentelemetry/core --all --workspaces`; likely through telemetry/observability packages | Root `package-lock.json` | Potentially reachable if observability/Sentry/OpenTelemetry runtime is enabled | Prefer patched observability package updates or semver-compatible override; validate instrumentation still initializes | `npm audit --audit-level=moderate --omit=dev`; web/API build; telemetry smoke if available | FOLLOW-UP only after reachability review |

## Required Validation For Stage 13

Run these commands during remediation, recording exact pass/fail output in this file or a linked follow-up audit:

```powershell
npm ci
npm audit --audit-level=high --omit=dev
npm audit --audit-level=moderate --omit=dev
npm run typecheck:web
npm run build:web
npm --workspace apps/web run lint
```

Also run exact GitHub workflow-equivalent commands where possible, including web build, Vercel parity build, and production stability audit equivalents.

The moderate audit may be documentation-only if the high-severity production gate passes and remaining moderate alerts are proven non-runtime or otherwise risk-accepted.

## Definition Of Done

- No unresolved high severity production dependency alerts remain.
- High alerts are fixed without `npm audit fix --force`.
- Moderate alerts are fixed or documented with production reachability and explicit risk verdict.
- Lockfiles are synchronized.
- Root `npm ci` passes.
- Production audit gate passes.
- GitHub Actions are green for the target commit.

## Current Verdict

NEEDS_REPLAN. The listed high alerts are release blockers until remediated or proven unreachable in production. This audit does not claim production readiness or controlled beta readiness.
