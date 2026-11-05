# MCP phase 1 verification — updated 2026-11-05

Implementation base: GitHub `main` at `994111a0`, isolated branch `codex/mcp-integration`. The user's original checkout was 191 commits behind and retained its original tracked changes.

## Passing checks

| Check | Result |
| --- | --- |
| API MCP tests and workspace-resolution regression tests | 45 tests passed |
| Web MCP relay, internal signing, dashboard layout, proxy and landing-list regression tests | 61 tests passed |
| Changed web surfaces lint | 8 files, zero errors/warnings |
| API and web type checks | Passed on Node 22.23.4 |
| Canonical/app Prisma schemas and migration mirrors | All match |
| Exact migration SQL applied to isolated local schema | Five tables and associated indexes created successfully |
| Actual SDK + full Fastify API + web + local Postgres | Passed; see [machine-readable smoke evidence](MCP_LOCAL_SMOKE.json) |
| Change whitespace validation | Passed |
| Web Prisma-import, route database-import and auth-mode guards | Passed; relay loads the database client at request time |

The real database smoke verifies registration, workspace consent, PKCE exchange, one-use codes, digest storage, discovery of all 31 tools, API-owned tasks/templates, blocked AI prompts, signed web-owned lead/campaign creation, draft status, foreign-workspace rejection, current-role enforcement and refresh-token-family revocation. No external outreach or production data was used. Test fixtures live only in the disposable `cmf-mcp-review-db` container on loopback port 55432.

The final supported-runtime check results are recorded in [MCP_NODE22_CHECKS.json](MCP_NODE22_CHECKS.json).

## PR #878 review follow-up — 2026-11-05

All CodeAnt inline findings and its three additional suggestions were checked against the current handlers.

| File | Finding and impact | Priority | Resolution |
| --- | --- | --- | --- |
| `apps/api/src/mcp/catalog.ts` | Lead updates advertised fields the web handler discarded, giving agents a false success. | Medium | Restrict updates to name, email, LinkedIn URL and company; reject unknown fields before dispatch. |
| `apps/api/src/mcp/catalog.ts` | Lead creation advertised `consentObtained`, which the selected handler never stores. | Medium | Reject the unsupported field; no consent is inferred or recorded. |
| `apps/web/src/app/api/mcp/execute/route.ts` | The body-size check ran after buffering, permitting excessive memory use. | High | Count incoming bytes, cancel oversized streams and reject declared oversized bodies before processing. |
| `apps/web/src/app/api/mcp/execute/route.ts` | Comparing normalized grant URLs with raw configuration could reject equivalent URLs. | Medium | Normalize the configured URL before comparing it; different resources remain rejected. |
| `apps/api/src/mcp/oauth.ts` | Expired spent-token digests accumulated without cleanup. | Medium | Prune expired digests on successful token issuance; retain live replay evidence and tolerate cleanup failures. |
| `apps/web/src/app/mcp/connect/page.tsx` | Cancel could preserve the actionable consent form during client navigation. | Medium | Perform a fresh navigation without the authorization parameters, resetting page state. |
| `apps/api/src/mcp/oauth.ts` | A concurrent refresh loser revokes the winning token family. | Intentional security behavior | Retained and regression-tested: a reused credential cannot be distinguished from theft. This follows [OAuth Security BCP, section 4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2). |

The earlier CodeQL test-fixture rate-limit finding was already fixed in `ab0dd0fa`; the subsequent CodeQL check passed.

## Limits and separate findings

- Final focused/regression checks use temporary Node 22.23.4, matching the project's supported major version. The system Node installation was not changed. Target-branch CI is still required before rollout.
- The earlier wider web source suite under host Node 26 had 1,125 passing tests and one failure in `LandingPageList.test.tsx` accessing `window.localStorage`. All 13 tests in that file pass under Node 22; no landing-page source change was needed. The focused/regression suites now total 106 passing tests.
- Chrome reached the live signed-in readiness wizard at 27%; `/dashboard` redirected to setup. No setup acknowledgement or values were submitted. The local MCP screen was rendered and its sign-in-required state inspected in Chrome.
- Real ChatGPT/Claude cloud linking has not been tested. The local endpoint is not a public HTTPS release, and client account/workspace restrictions still apply.
- MCP is disabled by default. Production migration, both service deployments, reverse-proxy accessibility and final client verification require rollout review.

The setup and remaining phase 2 surface are documented in [MCP_INTEGRATION.md](MCP_INTEGRATION.md). This is local feature evidence, not an overall platform launch assessment or a claim that every product flow is exposed through MCP.

## Hardening follow-up — 2026-11-05

Addressed the second CodeRabbit round and an independent review: user-keyed rate limits (including a grant-bound admission credential for the web relay), bounded database reads and response streaming, registration/grant caps with a cleanup job, enforced browser approval with `requestId` idempotency, unknown OAuth parameters ignored, and a separate `MCP_RELAY_SECRET`. Documentation corrections: rollout now enables MCP before verifying endpoints, and logout wording states that ordinary sign-out leaves agent connections active.

| Check | Result |
| --- | --- |
| `apps/api` MCP tests | 47 passed (Node 26.13.0 host runtime) |
| `apps/web` relay tests | 21 passed (Node 26.13.0) |
| Web type check | Passed |
| API type check | One error, `services/browser/browser-engine.ts` (`Browser.isConnected`), in a file this change does not touch |
| Prisma schema/migration mirrors (`scripts/db/compare-prisma-schemas.mjs`) | All match, including `20261105130000_mcp_reviewed_actions` |
| Deliberate failure | Changing the registration-cap assertion from 503 to 201 made the suite exit 1 (1 failed, 46 passed); the original assertion was restored and the suite passes |

Not done:

- `scripts/verify-inbound-mcp.ts` was updated (approval flow, independent relay key, and an existing foreign-workspace ICP checked separately from a missing one) but **not re-run**; the disposable Postgres container needs Docker, which was not running. [MCP_LOCAL_SMOKE.json](MCP_LOCAL_SMOKE.json) is the earlier run and only shows that a missing ICP is rejected. The foreign-ICP and deliberate-failure claims for the smoke script remain unproven until it runs.
- The Node 22 record in [MCP_NODE22_CHECKS.json](MCP_NODE22_CHECKS.json) predates this follow-up. The numbers above were produced on Node 26.13.0 and should be repeated on Node 22 and in CI.
- Behaviour that is deliberately unchanged: a concurrent refresh loser still revokes the token family.
- Documentation-comment coverage across the new MCP files is below CodeRabbit's threshold. That is a maintainability note, not a defect, and was left alone.
