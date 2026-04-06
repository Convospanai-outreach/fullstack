# Security Best Practices Report

Executive summary: the codebase has a few concrete exposure risks that matter more than the general hardening gaps. The most important are weak authorization around API key creation, an architectural split where `apps/web` enforces broad request controls but `apps/api` serves routes directly, and missing request-origin/CSRF validation on cookie-authenticated state-changing endpoints. There are also unauthenticated operational endpoints that disclose internal service topology.

## High

### SEC-001
- Rule ID: `NEXT-AUTH-001`
- Severity: High
- Location: `apps/api/routes/governance/keys/route.ts`
- Evidence:
  - `GET` only requires a valid session and uses the caller's first membership as the target workspace: lines 8-27.
  - `POST` does the same and creates a new API key without any role or permission check: lines 53-83.
  - The returned payload includes the full created `apiKey` object: line 83.
  - API key validation looks up the raw key value directly in the database: `apps/api/src/lib/apiAuth.ts` lines 11-31.
- Impact: any authenticated user with any membership on a team can mint long-lived API credentials for that team. If the database is ever exposed, keys appear to be stored in directly usable form rather than as hashes.
- Fix: require an explicit admin-level permission such as `MANAGE_KEYS` or `MANAGE_POLICY` before listing or minting keys, scope the team deterministically instead of using `memberships[0]`, and store only a hashed key fingerprint in the database.
- Mitigation: alert on key creation, reduce scopes on default keys, and rotate all previously issued keys after changing the storage format.
- False positive notes: this is only a false positive if another upstream layer blocks non-admin users from these routes, but no such check is visible in route code.

### SEC-002
- Rule ID: `NEXT-AUTH-002`
- Severity: High
- Location: `apps/api/server.ts`, `apps/web/src/proxy.ts`
- Evidence:
  - `apps/api/server.ts` auto-loads every `routes/**/route.ts` file and binds it directly in Fastify with no global auth gate: lines 136-176.
  - The broad auth/rate-limit/CORS/security-header logic lives in `apps/web/src/proxy.ts`: rate limiting at lines 56-89 and auth enforcement at lines 110-174.
- Impact: if the `apps/api` service is reachable directly from the network, requests can bypass the `apps/web` proxy layer entirely. That means proxy-enforced rate limits, auth gating, and security headers do not protect the direct API host.
- Fix: move mandatory request controls into `apps/api` itself, or ensure the API is private and only reachable through the trusted web/proxy layer.
- Mitigation: bind `apps/api` to a private network, restrict ingress at the load balancer, and add an explicit deny if requests are not coming from the expected reverse proxy.
- False positive notes: this depends on deployment. If `apps/api` is never internet-accessible and is only callable from `apps/web`, the immediate exposure is lower, but the app code alone does not enforce that boundary.

## Medium

### SEC-003
- Rule ID: `NEXT-CSRF-001`
- Severity: Medium
- Location: `apps/api/src/lib/auth.ts`, `apps/api/routes/settings/governance/route.ts`, `apps/api/routes/billing/topup/route.ts`
- Evidence:
  - `getCurrentContext()` is session-cookie based via `getServerSession`: `apps/api/src/lib/auth.ts` lines 219-231.
  - Mutating routes such as `PUT /settings/governance` and `POST /billing/topup` only check session/team context and then perform state changes: `apps/api/routes/settings/governance/route.ts` lines 35-88 and `apps/api/routes/billing/topup/route.ts` lines 5-30.
  - I found no CSRF token validation or explicit `Origin`/`Referer` enforcement for these routes. The only origin logic present is CORS handling in `apps/web/src/proxy.ts` lines 92-107 and 231-239, which is not a CSRF defense by itself.
- Impact: the app currently relies on session presence and browser cookie behavior rather than explicit anti-CSRF checks. The practical exploitability depends on cookie settings and deployment topology, but a trusted/allowed origin, same-site attack surface, or future cookie changes would make these routes easier to abuse.
- Fix: add explicit CSRF protection for cookie-authenticated mutating routes, or at minimum enforce strict `Origin` checks server-side on state-changing endpoints.
- Mitigation: keep auth cookies `HttpOnly` and `SameSite=Lax` or stricter, and keep the allowlist of credentialed origins as small as possible.
- False positive notes: if all authenticated mutations are only reachable from same-origin pages and cookies remain strict enough, exploitability is reduced, but the protection is implicit rather than enforced in route code.

### SEC-004
- Rule ID: `NEXT-ERROR-001`
- Severity: Medium
- Location: `apps/api/routes/system/status/route.ts`, `apps/api/routes/health/route.ts`
- Evidence:
  - `/system/status` reports database, edge node, and Netjana service names, statuses, latencies, and hardware identifiers: `apps/api/routes/system/status/route.ts` lines 15-104.
  - `/health` readiness exposes whether the database is up, whether edge runtime is configured/required, and internal failure details: `apps/api/routes/health/route.ts` lines 26-95.
  - `POST /health` echoes arbitrary JSON back to the caller: `apps/api/routes/health/route.ts` lines 97-102.
- Impact: unauthenticated callers can enumerate internal dependencies and service health. This is useful for reconnaissance, targeted denial-of-service planning, and identifying which optional integrations are currently active.
- Fix: keep a minimal unauthenticated liveness endpoint, but move detailed readiness and dependency status behind admin auth or a private network.
- Mitigation: strip service names, hardware IDs, and error detail from public responses.
- False positive notes: if these endpoints are only exposed internally by infrastructure, the risk is lower. That protection is not visible in the app code.

### SEC-005
- Rule ID: `REACT-CSP-001`
- Severity: Medium
- Location: `apps/web/src/proxy.ts`
- Evidence:
  - The CSP explicitly allows both `'unsafe-inline'` and `'unsafe-eval'` in `script-src`: lines 196-207.
- Impact: the app has a CSP header, but the current policy leaves common script-injection primitives enabled. If any XSS sink is introduced or already exists in a path not reviewed here, this policy will do much less to contain it.
- Fix: remove `'unsafe-eval'` first, then migrate away from inline scripts/styles so `script-src` can use nonces or hashes instead of `'unsafe-inline'`.
- Mitigation: add Trusted Types and keep server/client boundaries strict for secret-bearing modules.
- False positive notes: this is a hardening issue rather than proof of an exploitable XSS by itself.

## Low

### SEC-006
- Rule ID: `NEXT-LOG-001`
- Severity: Low
- Location: `apps/api/routes/support/contact/route.ts`
- Evidence:
  - The support route logs the full submitted name, email, subject, and message to stdout: lines 19-21.
- Impact: user-submitted PII and message contents will end up in application logs, which often have broader retention and access than the primary support system.
- Fix: redact or minimize logged fields and move support submissions into a structured ticketing flow.
- Mitigation: shorten log retention and restrict log access.
- False positive notes: if logs are strictly internal and short-lived this is less severe, but still unnecessary exposure.

## Validation steps

1. Verify `SEC-001` by logging in as a non-admin team member and calling `POST /governance/keys`; confirm whether a key is created.
2. Verify `SEC-002` by sending the same request to `apps/web` and directly to the `apps/api` port; compare auth, rate-limit, and header behavior.
3. Verify `SEC-003` by reviewing session cookie attributes at runtime and testing whether a cross-origin or same-site-origin request can hit a mutating endpoint without an app-issued CSRF token.
4. Verify `SEC-004` by requesting `/health` and `/system/status` from an unauthenticated client on the deployed environment and recording what operational detail is exposed.
5. Verify `SEC-005` by inspecting the final `Content-Security-Policy` response header in production and confirming whether inline/eval allowances are still present.

