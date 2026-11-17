# MCP runtime review — 2026-11-04

Scope: the local checkout and fetched GitHub `main`, the deployment/request topology, current customer workflow owners, MCP authorization and side effects. This is not a claim that every line in the monorepo or every production integration has been audited.

Local `main` started at `d61e500a`; fetched GitHub `main` was `994111a0`, **191 commits ahead**, with changes across 1,031 files. Implementation is isolated on `codex/mcp-integration` at `.worktrees/mcp-integration`, based on the newer commit. Existing local work was preserved. No merge, push, deployment or production migration was performed.

## Findings and decisions

| Priority | File/evidence | Problem and impact | Fix/owner |
| --- | --- | --- | --- |
| High | Local Git history vs `origin/main`; `README.md`; `.github/workflows/deploy-render.yml`; `deploy/oracle/docker-compose.*.yml` | The old local baseline lacks recent security and workflow fixes. Planning from its dated docs would misidentify hosting and product behavior. | Build in an isolated latest-main checkout; use current request owners and deployment files. Implemented. Owner: Codex Builder. |
| High | `apps/web/src/app/api/proxy/[...path]/route.ts`; web and API `campaigns/route.ts`, `leads/route.ts` | Both apps contain similarly named routes. The actual web campaign route requires a saved ICP and includes newer strategy/batch behavior; calling an older API counterpart can bypass product prerequisites. | Pin each tool's owner. Use a signed, one-use relay to the current web handlers for web-owned operations. Implemented and exercised against real local services. Owner: Codex Builder/Security. |
| High | `apps/api/routes/onboarding/status/route.ts` | After authenticating, this legacy route selects the user's first team instead of the requested workspace, so it cannot safely power multi-workspace MCP onboarding. | Do not expose it. Phase 2 should build guidance on the current readiness/setup flow and pinned workspace. Owner: Codex Builder/UX. |
| High | `apps/api/routes/pipeline/tasks/[id]/route.ts` | Completing a task linked to a sequence invokes `SequenceService.completeManualRun`; a generic task-update tool could trigger downstream outreach. | Exclude task completion from phase 1; review sequence effects and approvals before phase 2 exposure. Owner: Security/QA. |
| Medium | `apps/web/src/app/api/approvals/route.ts` | GET backfills orphan drafts into approval requests; it is not a pure read and differs from the registered-request list in the API. | Phase 1 uses the API's registered-request read, explains the narrower coverage, and provides no approve/reject tool. Owner: Codex Builder/UX. |
| High | `apps/api/src/mcp/oauth.ts`; web `/api/mcp/execute` | A shared API credential or browser session for agents would lose individual accountability and make revocation/team changes unsafe. | Per-user/workspace OAuth grants, PKCE, digests, rotating refresh tokens with reuse detection, active-membership/session checks, origin checks, bounded input and DB-backed one-use relay. Implemented. Owner: Security. |
| Medium | `docs/DEPLOYMENT_RUNBOOK.md`; `docs/deployment/oracle-vm-deployment.md`; older architecture/readiness snapshots | Some documents still describe Vercel/Neon or earlier migration plans despite current Render/Supabase topology. | Mark prior deployment guidance as historical where contradictory and link current README/pipelines plus the MCP integration guide. Older readiness numbers are not current MCP launch evidence. Owner: Codex Builder. |
| Medium | Local web test run | One landing-page localStorage test failed under host Node 26; 1,125 source tests passed. The project declares Node 22. | Rechecked under Node 22.23.4: all 13 landing-list tests pass; the final focused/regression suites have 88 passing tests. No unrelated landing logic was changed. Supported-runtime CI remains a rollout gate. Owner: QA. |

## Chrome evidence

Reviewed the live public funnel workflow and authenticated readiness wizard. Opening `/dashboard` redirected this account to `/setup` at 27% completion. The wizard currently has 14 steps and a personal/company mode; the campaign step prepares a workflow and optional meeting goal. Responsibility acceptance and setup values were not submitted. A full live dashboard review is still limited by this account's incomplete setup; local MCP verification uses synthetic fixtures instead.

## Approval gate

Review phase 1 implementation, test evidence and migration before enabling MCP publicly. Phase 2 includes both new-user onboarding and prospect suggestions, as clarified by the user, plus the remaining verified workflow coverage in [MCP_INTEGRATION.md](./MCP_INTEGRATION.md).
