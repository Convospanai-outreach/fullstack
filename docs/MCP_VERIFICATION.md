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

## Production findings and full-catalog smoke — 2026-11-05

The first real Claude connection exposed gaps that mocks and the SDK-based smoke could not: the review link was only in `structuredContent` (Claude shows `content[].text`), and the review window and expiry were not stated. Both are fixed, and `mcp.test.ts` now asserts what each reviewed-change outcome says in its text. Auditing the rest turned up two more: a rejected pipeline move and an unknown lead on task creation both returned HTTP 500, which MCP presents as an uncertain outcome. They now return 409 and 404 with a readable reason.

| Check | Result |
| --- | --- |
| `verify-inbound-mcp.ts` against the disposable database, full API and web | Passed. All 31 tools were called through the official SDK; results are judged on `content[].text`; each change is staged, approved and checked in Postgres |
| Bad-input sweep | 14 calls (unknown ids and rule violations across reads and changes) all returned a 4xx and left no uncertain outcome |
| MCP, pipeline and web relay tests on Node 22.23.4 | 89 passed (API 66, web 23) |
| Foreign-workspace ICP rejection | Now proven by the smoke (it was not before) |

## Production run — 2026-11-08

Observed against production with a real Claude connection (grant `356a44d3…`, all three scopes):

| Check | Result |
| --- | --- |
| `list_campaigns`, `list_leads` (web-owned, signed relay) | 200 with real data once the web service was awake |
| `create_task` first call | 202 PENDING with review URL and expiry in the text; no row written |
| Browser approval | `MCP_ACTION_APPROVED` audit row; action APPROVED |
| `create_task` retry, same `requestId` | 200; action SUCCEEDED; exactly one `Task` titled "MCP test" in the workspace |

Findings:

- The Render web service is on the free plan and sleeps. The first web-owned call after idle waited about 56 seconds and returned 401 "MCP delegation rejected", because the relay's 30-second signature window had passed by the time the service woke. Both audit rows showed status 401 with a duration near 56 s. A retry once the service was awake succeeded. Fix: a paid plan or a keep-warm ping; not changed in code.
- An earlier approval attempt, made while the service was cold, never registered (the action stayed PENDING with no approval audit row). The cause was not observed; the cold start is the likely explanation but is unproven.

Still unproven:

- ChatGPT has not been tested.
- The one-off 15-second consent timeout seen on first connection was not diagnosed; only one occurrence was recorded.
- A request left `RUNNING` by a crash is never retried automatically and stays reported as uncertain until inspected.
- The smoke sends no outreach and uses no provider credit, so `generate_message_preview` is only proven to be rejected by guardrails, not to produce a preview.
- Unrelated and untouched: a type error in `services/browser/browser-engine.ts` (`Browser.isConnected`).

Unchanged from earlier follow-ups:

- Behaviour that is deliberately unchanged: a concurrent refresh loser still revokes the token family.
- Documentation-comment coverage across the new MCP files is below CodeRabbit's threshold. That is a maintainability note, not a defect, and was left alone.
