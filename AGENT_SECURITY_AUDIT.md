# Audit Report: Agentic Security & Sovereign Walls

## 1. Executive Summary
The security architecture for PII protection (Sovereign Firewall) and autonomous execution (Agent Executor) is fundamentally sound but contains implementation gaps in the unmasking (detokenization) logic and fragmentation in the Computer Use modules.

## 2. Critical Findings

### 2.1 Detokenization Inconsistency
- **Issue**: `SovereignFirewall.mask()` returns an empty `tokenMap` when hitting the Edge Node, expecting the Vault to handle it. However, `AgentExecutor.ts` relies on a local `tokenMap` during the `unmask` phase.
- **Impact**: If the Edge Node is active, the agent's output (e.g., email drafts) will be sent to the user/target with tokens (e.g., `[PERSON_1]`) instead of actual names, as the unmasking logic has no local data to work with.
- **Recommendation**: Update `SovereignFirewall.unmask` to support asynchronous resolution via the `IdentityService` when tokens are detected that aren't in the local map.

### 2.2 Fragmented Computer Use Logic
- **Issue**: There are two competing implementations: `src/modules/caller/computer-use.ts` (Pure Mock) and `src/lib/mcp/servers/ComputerUseServer.ts` (MCP-based).
- **Impact**: Maintainability issues and potential for "Safety Logic" (like `initiateCall` guards) to be bypassed if the wrong service is called.
- **Recommendation**: Deprecate the pure mock in favor of the MCP server, and ensure all safety guards (TrustEngine/Approval) are unified.

### 2.3 Circuit Breaker Logic
- **Issue**: The `SovereignFirewall` fails-open to `maskLocal` if the Edge Node is down.
- **Impact**: While this maintains availability, if `STRICT_SOVEREIGNTY=true`, the system should fail-closed instead of falling back to regex-based local masking.
- **Recommendation**: Implement a strict enforcement flag check in the circuit breaker.

## 3. Production Readiness Checklist

| Component | Status | Note |
| :--- | :--- | :--- |
| **TrustEngine** | ✅ Ready | Policies enforced correctly at task start. |
| **Sovereign Firewall** | ⚠️ Fix Needed | Detokenization flow needs Vault integration. |
| **Agent Executor** | ✅ Ready | DFA state machine is robust and includes approval gates. |
| **Computer Use** | ⚠️ Fragmented | MCP server is the way forward; cleanup needed. |
| **Audit Logging** | ✅ Ready | EventStore captures all transitions and tool calls. |

## 4. Remediation Steps (Next 24 Hours)
1. **Unify Detokenization**: Create a `SovereignFirewall.unmaskAsync` that resolves tokens via `IdentityService`.
2. **Cleanup Call Modules**: Move all Computer Use logic into the `ComputerUseServer` and remove the standalone mock.
3. **Strict Mode**: Add logic to `mask()` to prevent local fallback if sovereignty requirements are strict.
