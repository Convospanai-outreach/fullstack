# CraftMyFunnel external MCP integration

Status: phase 1 implementation approved by the user on 2026-11-04 and finalized with 31 core tools. Local SDK, authorization, web-relay and database verification performed. Public rollout and phase 2 remain separate from this implementation approval. See [coverage and limitations](MCP_INTEGRATION.md) and [runtime findings](MCP_RUNTIME_REVIEW.md).

## Outcome and boundaries

Expose the existing API as a remote MCP server so a signed-in customer can connect an agent to one explicitly selected workspace. The agent acts as that customer, with the same team role, approvals, prompt policies and credit accounting. Existing in-process MCP clients are outbound integrations and remain separate.

The request has two review gates: build and verify phase 1 locally, present the result for approval, then implement phase 2 after approval. Do not deploy or apply production migrations during phase 1.

## Phase 1: connection and core workflows

1. Inspect the live interface in Chrome and inventory API-owned customer workflows. Document surfaces that require a separate web implementation or lack sufficient authorization.
2. Mount a stateless Streamable HTTP MCP endpoint on the existing Fastify service. Use the official TypeScript SDK, tool annotations, explicit input schemas and structured results. Never accept an arbitrary route, URL, identity or workspace from a tool argument.
3. Implement OAuth discovery, dynamic registration, authorization code with S256 PKCE, explicit workspace/scope consent, short-lived opaque access tokens, rotating refresh tokens and connection revocation. Store token digests; recheck active membership, account suspension and session version on every authenticated request.
4. Route curated tools through existing API handlers with a server-generated identity. Add a minimum-role check at the MCP boundary as well as preserving handler checks. Keep credentials, superadmin controls, payment changes and human approval decisions outside the agent surface.
5. Cover campaign preparation, lead management, lead journeys, pipeline/tasks, meetings, inbox drafts, knowledge, templates, analytics and workflow inspection where existing handlers support these safely. Provide a capability inventory explaining deferred actions.
6. Add a browser consent and connection-management page, setup instructions for ChatGPT/Claude, and focused security/protocol tests. Update architecture documents to identify the new inbound boundary.
7. Verify actual SDK initialization, discovery and calls over HTTP, OAuth success and rejection paths, cross-team isolation, scope/role restrictions, token expiry/replay/revocation and input validation. Report existing failures separately. Public ChatGPT/Claude connection verification requires a deployed HTTPS endpoint and customer authentication.

## Phase 2: current client features and guided workflows

Research official OpenAI, Anthropic and MCP documentation again at phase 2 implementation time. Do not promise that client-specific features work across all agents.

- ChatGPT: OAuth/security metadata, search/fetch where required by the target experience, rich embedded UI only if currently supported and useful, tool discoverability and confirmation behavior.
- Claude: remote connector authentication, tool discovery, supported resource/prompt/UI capabilities and compatibility with the current Messages API connector.
- New-user guidance: inspect the selected workspace's setup state and suggest concrete next steps (ICP, leads, sender setup, campaign drafts and review), without silently creating accounts or changing permissions.
- Prospect suggestions: use existing customer-authorized buyer signals/ICP data, explain reasons and provenance, and let the user review candidates before saving or contacting them. No invented contacts or guaranteed outcomes.
- Extend verified workflows: content plans/posts, landing-page briefs/assets/publishing, schedules, enrichments, inbox replies, CRM synchronization and workflow execution after checking each handler's authorization, billing, approval and external-effect behavior.

## Acceptance and rollout evidence

Phase 1 is reviewable when code, migrations, connection UI, setup guide, tool inventory and focused test results exist. Distinguish mocked service tests, real local HTTP protocol checks, database-backed checks and actual ChatGPT/Claude cloud checks. A local test pass is not overall launch readiness; target-branch CI and deployment verification remain required.

## Sources consulted (2026-11-04)

- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/plugins/build/auth
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

User clarified that phase 2 includes both new-user onboarding and prospect suggestions.
