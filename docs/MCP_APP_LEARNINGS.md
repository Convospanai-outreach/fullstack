# MCP App Learnings

This document describes the new internal MCP server for team-scoped app learnings.

## Purpose

Enable agents/services to:
- read app learnings safely
- share new learnings back into the app memory loop
- export compact TOON summaries for downstream systems

Implementation:
- Server: `apps/api/src/modules/integration/mcp/app-learnings-server.ts`
- Registration: `apps/api/src/lib/mcp/McpManager.ts` (`app-learnings`)

## Tools

### `read_app_learning_summary` (low risk)
Reads a sanitized summary for a team.

Input:
- `team_id` (required)
- `lookback_days` (optional, default from env)

### `read_app_learning_memories` (low risk)
Lists recent `AgentMemory` entries.

Input:
- `team_id` (required)
- `limit` (optional)
- `min_confidence` (optional)
- `key_prefix` (optional)

### `search_app_learning_events` (low risk)
Searches `SystemEvent` records for learning-related context.

Input:
- `team_id` (required)
- `query` (optional)
- `event_names` (optional)
- `limit` (optional)
- `lookback_days` (optional)

### `share_app_learning_memory` (high risk)
Writes a new learning memory and emits an `APP_LEARNING_SHARED` system event.

Input:
- `team_id` (required)
- `key` (required)
- `value` (required)
- `confidence` (optional, 0..1)
- `source` (optional)
- `user_id` (optional)

### `read_app_learning_toon` (low risk)
Exports compact TOON-style text for external sharing.

Input:
- `team_id` (required)
- `lookback_days` (optional)
- `max_rows` (optional)

## Security And Safety

- Team-scoped access via required `team_id`.
- PII scrubbing via `PIIScrubber` on returned string fields.
- Value size controls and result limits via env vars.
- Write tool is high-risk by MCP governance policy.

## Environment Variables

Defined in `apps/api/.env.example`:
- `MCP_LEARNINGS_DEFAULT_LOOKBACK_DAYS`
- `MCP_LEARNINGS_MAX_LIMIT`
- `MCP_LEARNINGS_MAX_VALUE_CHARS`

## Usage Example (server-side)

```ts
import { mcpManager } from "@/lib/mcp/McpManager";

await mcpManager.initialize();

const summary = await mcpManager.callTool("read_app_learning_summary", {
  team_id: "team_123",
  lookback_days: 14
});

const shared = await mcpManager.callTool(
  "share_app_learning_memory",
  {
    team_id: "team_123",
    key: "linkedin_touchpoint_stop_signal",
    value: "Pause on verification modal and require manual unlock.",
    confidence: 0.95,
    source: "ops_review"
  },
  { approved: true } // required by governance for high-risk tools
);
```

## Notes

- This MCP server is internal to `apps/api` and follows the existing `McpManager` registry pattern.
- Use `read_app_learning_toon` when you need token-efficient context sharing with external systems or workflows.

