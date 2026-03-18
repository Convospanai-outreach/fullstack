# Context Decisions and Freeze List

## Freeze List (Immediate)
- DAG/workflow expansion beyond current production use
- Graph/knowledge complexity expansion
- Stealth/scraping expansion beyond stable baseline
- Multi-channel sprawl beyond current enabled channels
- New "magic" naming in user-facing surfaces

## Deprecation Map (Naming)
- "Karmic Friction" -> `intent_score`
- "Adversarial Judge" -> `reply_classifier`
- "Protocol Break" -> `pii_reidentify`
- "Micro-LLM" -> `local_model`

## Product Surface Enforcement
- `outreach` surface hides runtime-only paths and controls
- `runtime` surface may expose edge and managed-runtime controls

## Execution Modes
- `saas_only`: outreach-only, no runtime dispatch
- `managed_runtime`: dispatch to managed runtime API
- `edge_runtime`: dispatch to edge node API

