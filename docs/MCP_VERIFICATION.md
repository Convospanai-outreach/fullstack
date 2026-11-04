# MCP phase 1 verification — 2026-11-04

Implementation base: GitHub `main` at `994111a0`, isolated branch `codex/mcp-integration`. The user's original checkout was 191 commits behind and retained its original tracked changes.

## Passing checks

| Check | Result |
| --- | --- |
| API MCP tests and workspace-resolution regression tests | 33 tests passed |
| Web MCP relay, internal signing, dashboard layout, proxy and landing-list regression tests | 55 tests passed |
| Changed web surfaces lint | 8 files, zero errors/warnings |
| API and web type checks | Passed on Node 22.23.4 |
| Canonical/app Prisma schemas and migration mirrors | All match |
| Exact migration SQL applied to isolated local schema | Five tables and associated indexes created successfully |
| Actual SDK + full Fastify API + web + local Postgres | Passed; see [machine-readable smoke evidence](MCP_LOCAL_SMOKE.json) |
| Change whitespace validation | Passed |

The real database smoke verifies registration, workspace consent, PKCE exchange, one-use codes, digest storage, discovery of all 31 tools, API-owned tasks/templates, blocked AI prompts, signed web-owned lead/campaign creation, draft status, foreign-workspace rejection, current-role enforcement and refresh-token-family revocation. No external outreach or production data was used. Test fixtures live only in the disposable `cmf-mcp-review-db` container on loopback port 55432.

The final supported-runtime check results are recorded in [MCP_NODE22_CHECKS.json](MCP_NODE22_CHECKS.json).

## Limits and separate findings

- Final focused/regression checks use temporary Node 22.23.4, matching the project's supported major version. The system Node installation was not changed. Target-branch CI is still required before rollout.
- The earlier wider web source suite under host Node 26 had 1,125 passing tests and one failure in `LandingPageList.test.tsx` accessing `window.localStorage`. All 13 tests in that file pass under Node 22; no landing-page source change was needed. The final focused/regression suites total 88 passing tests.
- Chrome reached the live signed-in readiness wizard at 27%; `/dashboard` redirected to setup. No setup acknowledgement or values were submitted. The local MCP screen was rendered and its sign-in-required state inspected in Chrome.
- Real ChatGPT/Claude cloud linking has not been tested. The local endpoint is not a public HTTPS release, and client account/workspace restrictions still apply.
- MCP is disabled by default. Production migration, both service deployments, reverse-proxy accessibility and final client verification require rollout review.

The setup and remaining phase 2 surface are documented in [MCP_INTEGRATION.md](MCP_INTEGRATION.md). This is local feature evidence, not an overall platform launch assessment or a claim that every product flow is exposed through MCP.
