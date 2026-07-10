# Stage 12B VAPT Scope

## VAPT Status

VAPT_SCOPE_READY

Stage 12B has not started. This document defines scope only; it is not a completed VAPT. Stage 12B execution should not begin until Stage 12A high findings are fixed or formally risk-accepted and safe test environments are ready.

## Assets in Scope

- Web application: `https://www.craftmyfunnel.live`
- API service: `https://fullstack-vz1l.onrender.com`
- Next.js web routes and server actions under `apps/web`
- Fastify/Next-style API routes under `apps/api/routes`
- Chrome extension code under `apps/api/src/extension`
- Clerk authentication integration
- Neon Prisma database access paths
- Redis/cache/rate-limit paths
- Gmail/Google Workspace integration paths
- LinkedIn extension/task paths
- NetjanaAI webhook/API integration paths
- LLM provider and AI agent/tool-call paths
- Knowledge-base, RAG, upload, import, export, analytics, billing, and audit-log surfaces

## Authentication Roles Required

- Signed-out anonymous user.
- Signed-in ordinary member.
- Signed-in team admin/owner.
- Signed-in org/system admin if applicable.
- API-key caller with read-only scope.
- API-key caller with write scope.
- Dedicated provider callback identities for Gmail Pub/Sub, NetjanaAI, Razorpay, and internal worker/service paths.
- At least two isolated test tenants: Team A and Team B.

## Test Environments Required

- Local environment for destructive/negative tests.
- Preview or isolated staging environment with seeded test-only tenants.
- Production for passive, low-volume checks only.
- No production active scanner, brute force, fuzzing burst, load test, destructive mutation, provider send, LinkedIn action, NetjanaAI call, or real LLM prompt without explicit human approval.

## OWASP Coverage

| OWASP area | Stage 12B scope |
| --- | --- |
| Broken Access Control | Full tenant, role, ownership, IDOR, API-key, provider callback, and admin-route tests |
| Cryptographic Failures | API-key hashing, OAuth token encryption, webhook secrets, internal HMAC, cookie/session flags |
| Injection | Prisma raw query, dynamic filters/sorts, command execution, template/regex/query injection |
| Insecure Design | Campaign send safety, provider abuse, business-logic and credit-spend abuse |
| Security Misconfiguration | CORS, CSP, headers, public status routes, environment separation, Redis namespace |
| Vulnerable Components | npm audit, GitHub alerts, direct/transitive runtime dependency review |
| Identification/Auth Failures | Clerk/NextAuth confusion, session fixation/replay, API-key scope checks |
| Software/Data Integrity | Webhook signatures, internal signatures, CI guardrails, extension update/permission risks |
| Logging/Monitoring | Secret redaction, PII logs, audit trail integrity, alert coverage |
| SSRF | Webhook, import, enrichment, scraping, URL preview, provider callback and outbound fetch paths |

## API Test Scope

- All `apps/api/routes/**/route.ts` handlers.
- `apps/web/src/app/api/**/route.ts` handlers.
- Internal proxy forwarding through `/api/proxy/[...path]`.
- API-key routes under `/v1/**`.
- Admin, settings, team, invitations, billing, governance, audit, exports/imports, webhooks, AI, inbox/mailbox, leads, campaigns, and workflow routes.
- HTTP method handling, malformed JSON, oversized payloads, invalid content types, invalid sort/filter/limit, and error redaction.

## Web Test Scope

- Signed-out route protection.
- Authenticated dashboard, leads, campaigns, settings, team, billing, governance, inbox, knowledge, and admin screens.
- Client bundle exposure, public env usage, public scripts, CSP/security headers, `dangerouslySetInnerHTML`, raw HTML rendering, redirects, and public approval pages.
- CSRF posture for cookie-authenticated mutations.

## Multi-Tenant Abuse Cases

- Team A user reads Team B lead/campaign/mailbox/webhook/API key/audit log.
- Team A user updates/deletes Team B resources by ID.
- Member attempts owner/admin actions.
- Client submits `teamId`, `ownerId`, `role`, `enterpriseRole`, `credits`, provider config, campaign execution state, approval state, or audit fields.
- API-key caller attempts access outside key team/scope.
- Webhook payload maps to another team.
- AI/RAG prompt asks for another tenant's leads, inbox, mailbox, campaign, or knowledge-base data.

## AI and Prompt-Injection Scope

- Prompt injection against chat, helper, email, landing, agent, RAG, and tool-call routes.
- Cross-tenant retrieval and semantic cache isolation.
- Provider-key leakage in errors/logs/browser.
- Credit reservation/refund correctness under errors.
- Tool-call authorization and team scoping.
- Output redaction and sensitive source citation behavior.

## Chrome Extension Scope

- Manifest permissions and host permissions.
- No cookie/session harvesting.
- Content-script DOM capture boundaries.
- Message-router origin and payload validation.
- User-initiated capture only.
- No background scraping, mass connect, mass message, or automatic LinkedIn action in V1.
- Storage of captured data and draft handling.

## Gmail OAuth Scope

- OAuth state validation and callback redirect constraints.
- Token encryption and response/log exclusion.
- Connected mailbox ownership.
- Gmail Pub/Sub verification and replay handling.
- Send rate limits and suppression checks.
- Test-only OAuth/send flow in staging before production.

## LinkedIn Scope

- Extension bridge authentication.
- Task endpoint tenant scoping.
- Manual visible profile capture proof.
- Rate limits and consent/UX gating.
- V2 automation kept out of public/provider testing until separate approval.

## NetjanaAI Scope

- Webhook signature and replay protection.
- Payload schema and size limits.
- Team mapping and SSRF classification.
- Pull API key handling.
- Error/log redaction.
- Safe staged callback tests only.

## Prohibited Production Tests

- Active ZAP/Burp scans against production.
- Brute force, credential stuffing, fuzzing bursts, or load tests.
- Destructive DB mutations, migrations, seeds, `db push`, truncates, deletes, or schema changes.
- Real Gmail OAuth/send, real LinkedIn messages/connections/scraping, NetjanaAI production callbacks, or real LLM prompts.
- Any test that can touch customer data outside a dedicated test tenant.
- Any test that prints secrets, cookies, JWTs, OAuth tokens, DB URLs, provider keys, or session data.

## Evidence Requirements

- Every finding must include route/file/line evidence or safe runtime evidence.
- Every PASS must have source evidence, test evidence, or runtime proof.
- Every dynamic test must record environment, account role, tenant, exact action, result, and whether data mutation occurred.
- Provider tests require explicit human authorization and test-only accounts.
- Logs and screenshots must be redacted.

## Exit Criteria

- Stage 12A is passed or all high/critical Stage 12A issues are fixed and retested.
- Dedicated staging/preview test tenants exist.
- All critical/high VAPT findings are fixed or formally risk-accepted by an owner.
- OWASP API and web coverage is complete.
- Multi-tenant IDOR tests pass.
- CSRF, CORS, CSP/security headers, SSRF, XSS, file/KB, webhook, prompt-injection, and provider abuse tests are complete.
- Public/enterprise readiness remains blocked until this exit is met.
