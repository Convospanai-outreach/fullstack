# Phase 9: Revenue + Contract Controls

## 1. Core Principle
**"No Ticket, No Ride."**
Execution is blocked at the infrastructure level if the ContractProfile does not explicitly authorize the action.
There are no "soft limits" or "grace periods" in this phase.
All denials are logged to the immutable `EventLog`.

## 2. Infrastructure Components

### A. Contract Resolver (`contractResolver.ts`)
The primary gatekeeper.
- **Input:** `teamId`, `capabilityLayer`, `channel`
- **Logic:**
  1. Checks if `ContractProfile` exists (Blocks if missing).
  2. Checks `contractStatus` (Must be `ACTIVE`).
  3. Checks `capabilityLayer` inclusion.
  4. Checks `allowedChannels` inclusion.
- **Outcome:** Throws strict error + Logs `CONTRACT_DENIAL` event.

### B. Usage Meter (`usageMeter.ts`)
The volume controller.
- **Source of Truth:** `SystemEvent` and `LLMUsageLog` (Database state).
- **Metric 1: AI Usage**
  - Aggregates `tokensIn` + `tokensOut` for the current month.
  - Frequency: Per-invocation check.
- **Metric 2: Threads**
  - Counts `active` threads or creation volume per billing period.
- **Metric 3: Handoffs**
  - Counts allocations to `MeetingCoordinationQueue`.
- **Outcome:** Throws `CONTRACT_LIMIT_EXCEEDED` + Logs `CONTRACT_LIMIT_BREACH`.

### C. Kill Switch (`killSwitch.ts`)
The emergency brake.
- **Scope:** Organization-wide.
- **Triggers:**
  - `contractStatus == TERMINATED` (Hard Stop)
  - `contractStatus == SUSPENDED` (Pause)
- **Granularity:**
  - Can target specific subsystems (`AI`, `OUTBOUND`, `CALLER`).
- **Audit:** Every trigger event is recorded as `KILL_SWITCH_TRIGGERED` in `EventStore`.

## 3. Implementation Details

### Hard-Block Execution
Code paths do **not** attempt recovery.
```typescript
try {
  await ContractResolver.resolveOrThrow(teamId, "GOVERNED_AI");
} catch (e) {
  // Stop immediately. Do not queue. Do not retry.
  return res.status(403).json({ error: e.message });
}
```

### Event-Driven Auditing
Denials are not just errors; they are business events.
- **Event:** `CONTRACT_DENIAL`
- **Payload:** `{ reason: "Missing layer: GOVERNED_AI", checkType: "CAPABILITY_CHECK" }`
- **Purpose:** Allows Sales/Support to see *why* a customer is blocked without accessing logs.

## 4. Operational Safety
- **Read-Only Access:** Even `TERMINATED` contracts retain read-access to audit logs (via `KillSwitch` design, ensuring we don't block `GET /audit`).
- **Fail-Closed:** Missing profiles default to BLOCKED.

## 5. Rollout Strategy
1. **Migration:** Create default `ContractProfile` for all existing teams (Tier: CORE).
2. **Integration:** Wrap `AgentExecutor.execute()` and `CampaignService.send()` with Resolver checks.
3. **Monitoring:** Watch for `CONTRACT_DENIAL` events in the dashboard.
