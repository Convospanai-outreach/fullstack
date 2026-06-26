# Application Security Hardening Plan

Date: 2026-06-26
Branch: `docs/app-security-hardening-plan`
Base branch verified: `origin/main`
Latest verified `main` SHA: `88dd014a07c583ce2fd528dcee49c756d937cf6d`

## Executive summary

Application security hardening is a mandatory production-readiness blocker for CraftMyFunnel Teams and Enterprise Edition. A green Vercel deployment, a `200` health response, or a basic database connectivity result can prove infrastructure liveness, but it does not prove that protected multi-tenant application behavior is safe.

This plan adds a required security-hardening phase before CI/PR strategy and final readiness. The phase must prove tenant isolation, authorization, input validation, mutation controls, rate limits, abuse resistance, and AI-chat data boundaries before any controlled-beta or production-ready claim.

## Latest main reassessment

| Check | Evidence | Verdict |
| --- | --- | --- |
| Latest `main` SHA | `git fetch origin --prune`; `git rev-parse origin/main` returned `88dd014a07c583ce2fd528dcee49c756d937cf6d` | VERIFIED |
| Current `main` head | `git log -n 25 origin/main` shows `88dd014 Merge pull request #42 from Convospanai-outreach/docs/api-origin-production-health-followup` | VERIFIED |
| DB-health-green docs commit | Local/remote branch `docs/api-db-health-resolved` contains `2a60a5926275efdbc95eb1df40197371a1004b76 docs(readiness): record production api and db health as resolved` | FOUND_OFF_MAIN |
| DB-health-green on `main`? | `git merge-base --is-ancestor 2a60a59 origin/main` returned non-zero; recorded result: `NOT_ON_MAIN` | NOT_ON_MAIN |
| Commit author/date | `git show --no-patch 2a60a59` shows author `Sid <net0rotator@gmail.com>`, date `Thu Jun 25 15:29:15 2026 +0530` | RECORDED |
| Runtime/infra claims | No GitHub/Vercel log evidence was used in this docs-only pass beyond git metadata already present in repo docs. Chat claims were not treated as evidence. | CAUTIOUS |

If DB readiness is later documented as green from Vercel production `/api/health`, classify it as infrastructure readiness only unless the application security stage also passes. Database connectivity does not prove tenant authorization, ownership checks, safe mutation boundaries, AI-chat isolation, or abuse resistance.

## Scope

This audit plan covers protected endpoints, server actions, and service paths touching:

- teams
- users
- team members
- roles
- leads
- campaigns
- email sequences
- connected mailboxes
- inboxes
- analytics
- settings
- billing
- invitations
- integrations
- API keys
- chat/assistant routes
- file/knowledge-base routes

## Route inventory format

Every protected route and server action must be inventoried with this table:

```text
Route | Method | Auth required | Team scope required | Resource ownership check | Mutable fields whitelist | Rate limit | Raw SQL used? | JWT/session validation | Test exists? | Verdict
```

Verdict values:

- `PASS`
- `FAIL`
- `MISSING`
- `NEEDS_VERIFICATION`
- `NOT_APPLICABLE`
- `BLOCKER`

## Mandatory control checklist

| Control area | Required proof | Blocks readiness if missing? |
| --- | --- | --- |
| Auth coverage | Every protected route/server action validates Clerk, NextAuth, API token, webhook signature, or service identity server-side | Yes |
| Tenant isolation | Every team-scoped read/write verifies team membership and resource ownership, not just a client-selected `teamId` | Yes |
| Role enforcement | Privileged actions enforce server-side roles for owners/admins/members/viewers | Yes |
| Mutable-field allowlists | Create/update endpoints accept only reviewed fields and reject unsafe mass assignment | Yes |
| Runtime validation | Request params, query, body, form data, files, and server action args are validated at runtime | Yes |
| Database safety | Prisma raw SQL and dynamic filters/sorts/searches are parameterized and validated | Yes |
| CSRF posture | Cookie-authenticated state-changing routes/server actions have CSRF or strict origin protections | Yes |
| Rate limits | Auth, invite, import, send, webhook, analytics, and AI-chat paths have user/IP/team-aware throttles | Yes |
| AI-chat isolation | Assistant routes cannot retrieve, summarize, tool-call, or exfiltrate data across tenants | Yes |
| File/KB safety | Upload, ingestion, download, and knowledge-base routes validate type/size/path/access | Yes |
| SSRF protection | URL import, webhook, scraping, preview, enrichment, and integration fetch paths restrict destinations | Yes |
| XSS/content safety | User HTML, markdown, email content, and assistant output are sanitized or safely rendered | Yes |
| Security headers/CORS | CSP, frame protections, CORS, redirect, host/callback URL controls are verified in app or edge | Yes for exploitable gaps |
| Logging/redaction | Errors and logs avoid secrets, tokens, cookies, PII overexposure, and internal stack leakage | Yes for high-risk leakage |
| Tests | Critical/high controls have unit, integration, or API smoke coverage | Yes |

## Abuse cases to prove

| Abuse case | Expected result |
| --- | --- |
| User from Team A requests Team B lead/campaign/inbox/resource by ID | Denied server-side |
| Member without admin role edits roles, billing, integrations, API keys, or connected mailboxes | Denied server-side |
| User supplies extra mutable fields such as `teamId`, `role`, `ownerId`, `billingPlan`, or `isAdmin` | Rejected or ignored by allowlist |
| Unauthenticated request hits protected API or server action | Denied before data access |
| Cookie-authenticated state-changing request comes from an untrusted origin | Denied |
| High-volume lead import, invite, campaign send, webhook, or AI-chat request bursts | Throttled or queued safely |
| AI chat asks for another team's leads, mailbox data, campaigns, or knowledge-base documents | Denied and logged as an access-control event |
| File/knowledge-base route receives path traversal, oversized file, active HTML/SVG, or unsafe MIME | Rejected or served safely as attachment |
| Integration/webhook URL points to localhost, private IPs, metadata service, or unsupported schemes | Rejected |
| Route throws internal error with token/cookie/env details | Client receives sanitized error; server log redacts sensitive fields |

## Evidence requirements

Each finding or pass must cite one of:

- route or server-action file path and line reference
- test file and test command
- safe command output with no secrets
- deployment/runtime header evidence with no secret values
- documented external-access blocker

Do not rely on chat claims. Do not inspect, print, or store secret values. Do not change OAuth scopes, Chrome extension permissions, DB schema, Prisma schema, migrations, or provider settings as part of this docs-only stage.

## Sign-off criteria

This stage can be marked complete only when:

- the route inventory is complete for all listed domains
- all `CRITICAL` and `HIGH` application-security findings are fixed or formally risk-accepted by an owner
- all tenant isolation, role, ownership, mutable-field, and auth checks have tests or documented compensating evidence
- AI-chat and knowledge-base isolation controls have explicit abuse-case coverage
- rate-limit and expensive-operation abuse controls are verified
- `docs/codex/VERIFICATION_MATRIX.md` records the app-security gate as passing
- `docs/codex/WORKFLOW_STATE.md` moves Stage 12 to `READY_FOR_NEXT_STAGE`

Until then, CraftMyFunnel must remain not production-ready and not controlled-beta ready.
