# ConvoSpan Agent Architecture

## Overview

ConvoSpan now follows a clear multi-layer split with explicit execution modes:

1. **Intel Layer (NetJana)**
   External signal discovery and intent intelligence.

2. **Control Layer (ConvoSpan Cloud / Next.js)**
   Product UI, orchestration, billing, and runtime routing.

3. **Execution Layer (FastAPI Runtime)**
   Managed Runtime API (cloud) and optional Edge Node (local/sovereign).

Execution modes:
- `saas_only` (control plane only)
- `managed_runtime` (cloud FastAPI)
- `edge_runtime` (local FastAPI edge)

---

# Layer 1: Intel Agents (NetJana)

These run outside the core app and feed signals into the runtime layer.

## Signal Discovery Agent
Purpose: Detect business signals from external data.

Output:
```
{
  signal_type,
  company,
  signal_strength,
  signal_timestamp
}
```

## Pain Point Analyst Agent
Purpose: Convert signals into outreach insights.

Output:
```
{
  company,
  pain_points,
  outreach_angles
}
```

## Lead Qualification Agent
Purpose: Score leads against ICP.

Output:
```
{
  lead_id,
  score,
  qualification_reason
}
```

---

# Layer 2: Control Plane Agents (ConvoSpan Cloud)

These agents are orchestration-focused and should remain lightweight.

## Campaign Planner Agent
Purpose: Build outreach sequences and workflows.

Output:
```
{
  campaign_workflow
}
```

## Message Composer Agent
Purpose: Generate outbound messages from lead context.

Output:
```
{
  message_text
}
```

## Reply Intelligence Agent
Purpose: Classify replies.

Output:
```
{
  intent,
  confidence,
  next_action
}
```

## Compliance Guard Agent
Purpose: Apply safety policies and routing rules.

Output:
```
{
  allow,
  policy_flags,
  redactions
}
```

---

# Layer 3: Execution Agents (Managed Runtime + Edge)

These agents run in FastAPI runtimes and handle heavier execution tasks.

## Runtime Executor Agent
Purpose: Execute tasks that are heavy, async, or integration-bound.

Output:
```
{
  task_id,
  status,
  result
}
```

## Tokenization Agent
Purpose: Mask or tokenize PII for safe execution.

Output:
```
{
  tokenized_payload,
  token_map_id
}
```

## Model Router Agent
Purpose: Route requests to the correct model/provider.

Output:
```
{
  provider,
  model,
  routing_reason
}
```

## Browser Executor Agent (Edge Only)
Purpose: Run local browser automation with session persistence.

Output:
```
{
  action_id,
  status,
  artifact_urls
}
```

---

# Notes

- NetJana remains external and should feed signals via Managed Runtime APIs.
- The Control Plane only orchestrates and routes; it does not run heavy execution.
- Edge is optional and shown as an upsell path in the UI.
- Task contracts and execution modes are now enforced across services.
