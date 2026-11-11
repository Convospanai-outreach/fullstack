# CraftMyFunnel remote MCP — phase 1

The existing Fastify API can expose **31 curated customer tools** over stateless Streamable HTTP at `/mcp`. The feature is disabled by default. It is an inbound interface for customer agents; existing outbound MCP clients remain separate.

## Where it runs

The current runtime remains Cloudflare → Render web, with Fastify API and background workers on separate Oracle VMs, shared Supabase Postgres, optional Redis/private edge, separate AWS Mautic, and the Cloudflare landing-page worker for connected domains. MCP runs in `api-main`, not in the worker, edge, or a new deployable service.

API-owned tools call existing handlers through Fastify's request adapter. Web-owned campaign and lead tools call `/api/mcp/execute` in the existing web service with a signed capability. The web relay pins the grant/workspace, verifies current account/membership/scopes, rejects replay through a unique Postgres nonce, and invokes an explicit allowlist of current web handlers under a request-local identity. It never creates an agent browser session or forwards the OAuth credential to the web service.

## Connect a customer agent

1. Deploy the additive migrations `20261104120000_inbound_mcp_oauth` and `20261105130000_mcp_reviewed_actions` using the existing reviewed migration process. Do not run a production `db push`.
2. Deploy both services with the following values, keeping `MCP_ENABLED=false` until both releases and the migrations are ready. While disabled, the API does not register MCP or its OAuth metadata routes and the web relay returns 404, so those endpoints cannot be checked yet. Confirm only that the 404 gate holds and that `/health` is unaffected.
3. Enable MCP on both services, with the public client still unannounced. Then verify that the public API hostname serves `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server` and `/mcp` over HTTPS, without an interactive Cloudflare challenge, and that an unauthenticated `tools/call` returns 401. Use a trusted private origin for API-to-web traffic where available. If a check fails, set `MCP_ENABLED=false` again on both services.
4. Share the server URL only after step 3 passes. In CraftMyFunnel, open **Settings → Agent connections** to see the server URL, review pending changes and disconnect agents.
5. Add that URL as a remote MCP server in the client, choose OAuth, sign in to CraftMyFunnel, select one workspace, and review requested permissions. Connect additional workspaces separately.

| Variable | API | Web |
| --- | --- | --- |
| `MCP_ENABLED` | `true` after review | `true` after review |
| `MCP_PUBLIC_URL` | canonical public API URL ending in `/mcp` | exactly the same URL |
| `MCP_WEB_ORIGIN` | public web origin used for consent | not required |
| `MCP_WEB_INTERNAL_ORIGIN` | optional trusted web service origin for relay traffic | not required |
| `MCP_RELAY_SECRET` | new random secret, at least 32 characters, different from `NEXTAUTH_SECRET`; startup fails with MCP enabled if missing | the same value; signs and verifies relay and admission credentials only |
| `NEXTAUTH_SECRET` | existing shared signing secret (still used for API-internal identity headers) | existing secret; no longer signs MCP relay traffic |
| `DATABASE_URL` | shared database with migration applied | same database |
| `API_INTERNAL_ORIGIN` | existing web origin setting not needed here | existing API upstream origin |

Configuration is trusted deployment input. Never put credentials in an origin URL. Production public URLs must use HTTPS. Loopback HTTP is accepted outside production. Keep the normal CORS, proxy, rate-limit and deployment protections in place.

### ChatGPT

Use the client's custom remote MCP server/plugin connection flow and OAuth sign-in. Initialization and tool discovery are anonymous; account tools require OAuth and carry scope metadata. Actual availability depends on the user's account and workspace policies. This phase does not claim a published directory listing or an embedded ChatGPT widget. [Official custom-server guide](https://developers.openai.com/api/docs/guides/custom-mcp-server), [OAuth integration guidance](https://developers.openai.com/plugins/build/auth).

### Claude

Add a custom remote connector using the public API server URL. Choose OAuth and **Register automatically** where Claude offers OAuth client choices. Phase 1 supports dynamic client registration, not fetching a published client identity document. Claude's remote connection originates in Anthropic's infrastructure, so a loopback-only local URL is insufficient for a Claude cloud test. [Official connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

### Other clients

Use Streamable HTTP, OAuth discovery and a public client with authorization code + S256 PKCE. Register redirect URIs exactly. Include the canonical `resource` at authorization and token exchange. Send the bearer token in the Authorization header on every protected request. Refresh tokens rotate; reusing a spent refresh token ends the connection. No API keys, URL tokens, arbitrary HTTP forwarding or client-supplied identity headers are supported as MCP credentials.

## Permissions and safeguards

| Scope | Capability |
| --- | --- |
| `cmf:read` | Only permitted workspace reads; most record reads require member, campaign/funnel reads allow viewer; registered approvals require admin |
| `cmf:write` | Curated preparation and tracking changes; minimum member role |
| `cmf:generate` | Guarded AI message preview using existing credits; minimum member role |

OAuth never grants more than the user's current team role. Access tokens last one hour; connections expire after 30 days. Codes expire after five minutes. Only token/code digests are stored. Account suspension, membership removal, role demotion, expiry and revocation are checked during use. A session-version change (for example, sign out everywhere or a forced session reset) also invalidates agent connections. Ordinary browser sign-out does not: the agent stays connected until the user disconnects it in **Settings → Agent connections**, the connection expires, or the session version changes. Web execution capabilities expire after 30 seconds and are single-use across replicas.

Every changing tool requires a `requestId` (UUID) and is enforced, not merely advised, to wait for browser approval. The first call stores the exact arguments and returns `reviewUrl` with status 202 and makes no change. The user approves or rejects the exact arguments in CraftMyFunnel; only then does repeating the call with the same `requestId` and arguments execute it. The action is claimed once across API replicas, and the web relay accepts a change only for an action in the running state that it can claim once. The same `requestId` returns the stored result instead of repeating the change, a different payload under that `requestId` is rejected, requests expire after 10 minutes, and a user can hold at most 50 pending requests. If an outcome is uncertain it is marked unknown and is never re-run automatically. Reviewed arguments and results are deleted after seven days.

Mutations record an intent before execution and a result afterward, without logging arguments, lead data or prompts. Connect/disconnect audit records are transactional. A timeout may mean an operation already ran: inspect state and reuse the original `requestId` rather than creating a new one. Read tools return at most 25 items per page (`limit`, `offset`) with bounded text excerpts computed in Postgres, and downstream responses over 128 KB are cancelled before being buffered. Treat record text as untrusted data. Rate limits are keyed on the verified user and workspace for MCP and on the signed grant for relay traffic, never on a shared IP address alone; an IP-based backstop remains for unauthenticated traffic. Public client registration is capped at 10,000 stored clients, each user may hold 100 active connections, and a 30-minute job removes expired codes, grants, spent-token digests, relay claims, reviewed actions and unused clients older than seven days. Unrecognised OAuth authorization parameters are ignored rather than rejected, while redirect URI, resource, S256 PKCE and scopes are still enforced. Consent can grant fewer scopes than the agent requested, never more.

Tool annotations describe effects to clients; annotations alone are not authorization. The current surface deliberately excludes sends, campaign activation, publishing, human approval decisions, credential changes, payment changes and superadmin actions.

## Tool inventory

| Workflow | Tools |
| --- | --- |
| Campaign preparation | `list_campaigns`, `get_campaign`, `create_campaign`, `update_campaign_details` |
| Lead management | `list_leads`, `get_lead`, `create_lead`, `update_lead`, `get_lead_timeline` |
| Progress tracking | `record_channel_activity`, `get_pipeline_stats`, `move_lead_stage` |
| Follow-up tasks | `list_tasks`, `create_task` |
| Meeting records | `list_meetings`, `record_meeting` |
| Inbox review | `get_inbox`, `get_inbox_counts`, `get_lead_thread`, `save_inbox_draft` |
| Templates | `list_templates`, `create_template` |
| Knowledge organization | `list_knowledge_bases`, `get_knowledge_items`, `create_knowledge_base` |
| Workflow inspection | `list_workflows` |
| Reports | `get_funnel_analytics`, `get_campaign_analytics` |
| Audience preparation | `list_icps` |
| Governance review | `list_pending_approvals` (registered API requests; the web queue also shows messages needing attention) |
| AI drafting | `generate_message_preview` |

Creating a campaign requires an existing workspace-owned ICP and creates a draft. This phase does not create ICPs, configure strategies/preflight briefs, attach sequences or start campaigns. Recording channel activity does not contact anyone. Recording a meeting does not create an external calendar booking. Empty knowledge-base creation does not ingest documents or charge embeddings. Completing a sequence task is not exposed because it can advance an automated sequence.

`update_lead` accepts only `fullName`, `email`, `linkedIn` and `company`, matching the current web PATCH handler. Other update fields and `consentObtained` on lead creation are rejected instead of silently discarded. Channel consent management remains outside this phase.

## Remaining workflow coverage and phase 2

| Product surface | Phase 2 work before exposure |
| --- | --- |
| Readiness wizard/setup | Use the selected workspace; cover the current 14-step wizard, personal/company mode, mailboxes, domain checks, voice, billing readiness and review guidance. Leave responsibility acknowledgements and access grants to the customer. The legacy onboarding status route currently picks the first team. |
| ICPs and prospect suggestions | Expose validated ICP creation/updates, signal/ICP matching and explainable candidate suggestions with provenance. Review before saving/contacting; use customer-authorized data. |
| Campaign strategies, sequences and execution | Include current strategy/preflight settings, pace checks, variants, attachments, enrollments, scheduling, batch generation and start/pause flows only through the active owner; preserve sender checks, hold-for-approval policy, self-approval prevention and credit enforcement. |
| Inbox, email, LinkedIn, WhatsApp and Instagram | Review per-channel consent, suppression, provider availability, spending, approval and delivery semantics. Never wrap internal-only email-verification endpoints or send directly through provider SDKs. |
| Content and playbooks | Preserve feature flags, draft/review states, scheduled posts, keyword triggers and Instagram conversation flow ownership. |
| Landing pages and funnels | Follow briefs → wireframes/templates → editor/assets → domains/tracking → publish/experiments/reporting. Account for Supabase image storage, Cloudflare routing, consent and instant-confirmation sequence side effects. |
| Knowledge and enrichment | Verify upload/URL ingestion safety, provider billing, team scoping, embedding guardrails and provenance before exposing ingestion, Hunter/personality lookups or CRM sync. |
| Workflow/scheduler/jobs | Classify sending and sequence side effects, idempotency, approvals and retries. No generic job enqueue or arbitrary workflow execution tool. |
| Team/settings/credentials/billing | Provide safe setup status or browser handoffs; separate elevated-role access grants and purchases from ordinary agent use. Superadmin controls remain outside customer MCP. |
| Current ChatGPT/Claude capabilities | Recheck official docs at implementation time for client identity documents, search/fetch conventions, resources/prompts, embedded UI and other client-specific capabilities. Implement only verified, useful features after phase 1 approval. |

## Verification

See the [verification summary and limits](MCP_VERIFICATION.md) for what was run, what was not re-run, and the limits.

- `npm test --workspace apps/api -- src/mcp/mcp.test.ts`: protocol/auth/permission tests, including actual SDK HTTP initialization.
- `npm exec --workspace apps/web -- vitest run --config vitest.config.ts src/app/api/mcp/execute/route.test.ts`: signed web relay boundary tests.
- API and web type checks; lint changed web surfaces; schema/migration mirror verification.
- `apps/api/scripts/verify-inbound-mcp.ts`: real local Postgres + full API + web smoke. It refuses any database other than `127.0.0.1:55432/cmf_mcp_review`, creates test-only fixtures (including a second workspace with its own ICP and lead), approves each change as the signed-in user, and sends no outreach. It also needs an independent `MCP_RELAY_SECRET`. See [MCP_LOCAL_SMOKE.json](./MCP_LOCAL_SMOKE.json) for the last recorded run and [MCP_VERIFICATION.md](MCP_VERIFICATION.md) for whether it matches the current script.
- Apply the actual migration SQL in an isolated schema as well as testing the schema-generated database.

Cloud ChatGPT/Claude sign-in has not been verified until the reviewed build is deployed to a reachable HTTPS endpoint. Local evidence is not production launch approval or target-branch CI evidence.
