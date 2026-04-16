# MCP Architecture Memo

## Objective

Make MCP a reliable internal control plane for ConvoSpan so agents and operators can use tools safely, consistently, and efficiently without duplicating runtime logic across apps.

## Current State

The monorepo already contains a working MCP-style foundation in both `apps/api` and `apps/web`, including client, transport, manager, and internal tool wrappers. MCP is already part of the agent runtime, where tools are discovered, surfaced to the model, gated through approval, and executed. That is a strong base.

The main issue is architectural sprawl. MCP logic is duplicated across the API and web apps, some "servers" are really in-process wrappers instead of clean backend-owned services, and parts of the transport and execution path appear only partially hardened. As the tool surface grows, this will increase drift, security risk, and maintenance cost.

## Target Architecture

`apps/api` should become the single MCP authority for the product. MCP execution, tool registry, credentials, audit, and policy enforcement should all live server-side. `apps/web` should not host its own parallel MCP runtime; it should consume MCP-backed capabilities only through API boundaries.

The MCP layer should have four core responsibilities:

- Tool registry: authoritative metadata for each tool, including owner, auth scope, risk level, timeout, env dependencies, and audit policy.
- Transport and runtime: one shared implementation for MCP clients and internal adapters.
- Governance: approval, logging, and policy enforcement for sensitive tool calls.
- Observability: latency, failures, usage, and execution traces for every tool invocation.

This turns MCP from a feature embedded in multiple apps into a platform capability owned by the backend.

## Recommended First-Class MCP Domains

- `ops`: health checks, job status, retry and replay controls, queue visibility, recent failures.
- `data-readonly`: safe Prisma-backed reads for campaigns, approvals, audit logs, team settings, and workflow state.
- `docs-search`: architecture docs, runbooks, setup instructions, and troubleshooting steps.
- `integrations`: Gmail, Slack, Netjana, and future external systems, all behind centralized auth and audit.

## Non-Goals for Now

- Expanding the number of MCP tools before consolidation.
- Treating `apps/web` as an equal MCP runtime peer.
- Broad third-party MCP interoperability work before internal boundaries are cleaned up.

## Key Risks

- Drift between duplicated MCP implementations in `apps/api` and `apps/web`.
- Secret sprawl and inconsistent access control in integration tools.
- Partial protocol assumptions in the current transport layer causing interoperability issues later.
- Growing tool discovery and routing complexity without a formal registry.

## Phase Entry Gates (Must Pass Before Rollout)

- Phase 1 gate: `apps/api` MCP initialization must be idempotent and resilient to partial server failure; one failing server must not block others.
- Phase 1 gate: Tool ownership must be pinned in a registry; duplicate tool names across servers must be rejected or explicitly resolved.
- Phase 2 gate: High-risk tools must require explicit approved execution context; approval edits must be revalidated against tool schema before execution.
- Phase 2 gate: Integration tools must support blast-radius controls (for example allowlists for recipients/channels) and reject header-injection payloads.
- Phase 3 gate: Read-only operational tools must bypass manual approval when classified low-risk, while preserving full audit telemetry.
- Phase 5 gate: External MCP interoperability work requires configurable message endpoints and transport compatibility tests against at least one non-internal server.
## Phased Rollout Plan

### Phase 1: Consolidate

Create one backend-owned MCP runtime and deprecate the mirrored implementation in `apps/web`. Keep all execution server-side. Define a canonical tool registry and standard metadata contract.

### Phase 2: Harden

Add unified telemetry, auth boundaries, audit logging, timeout handling, and approval classification for all tools. Separate low-risk read tools from high-risk action tools.

### Phase 3: Operationalize

Launch three high-value internal servers first: `ops`, `data-readonly`, and `docs-search`. These will reduce debugging time, script hunting, and manual operator work quickly.

### Phase 4: Normalize Integrations

Bring Gmail, Slack, Netjana, and similar integrations under the same backend-owned registry, auth, and observability model. Replace ad hoc wrappers with a more uniform server pattern.

### Phase 5: Expand Carefully

Only after consolidation and hardening, improve external MCP interoperability and add more advanced execution surfaces like computer-use or richer automation flows.

## Success Criteria

- One authoritative MCP runtime.
- No duplicated MCP core stack in `apps/web`.
- Every tool has clear ownership, policy, and telemetry.
- Operators and agents can answer common operational questions through MCP instead of manual repo and script exploration.
- New tools become easier to add because the platform boundary is stable.

## Bottom Line

This repo does not need more MCP surface area first. It needs one clean MCP backbone in `apps/api`, a formal registry and governance model, and a small set of high-leverage internal tools that improve operator efficiency immediately.

