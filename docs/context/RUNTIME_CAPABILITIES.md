# Runtime Capability Matrix

This matrix defines what each execution mode can do, and where requests should route.

## Execution Modes

- `saas_only`: Control plane only, no heavy runtime.
- `managed_runtime`: Cloud FastAPI runtime.
- `edge_runtime`: Customer Edge Node runtime.

---

## Capabilities by Mode

| Capability | saas_only | managed_runtime | edge_runtime |
|---|---:|---:|---:|
| Tokenize / Mask PII | ? | ? | ? |
| LLM Generation | ?? (light only) | ? | ? |
| Classification | ?? (light only) | ? | ? |
| Browser Automation | ? | ?? (limited) | ? |
| Local Session Persistence | ? | ? | ? |
| On-prem PII Vault | ? | ? | ? |
| Compliance / Sovereign Mode | ? | ?? (partial) | ? |
| Offline Execution | ? | ? | ? |
| Heavy Model Routing | ? | ? | ? |

Legend:
- ? Supported
- ?? Limited / policy-gated
- ? Not supported

---

## Routing Rules (Summary)

- `saas_only`
  - Use control plane only.
  - No PII-bearing tasks.

- `managed_runtime`
  - Route heavy tasks to Managed Runtime API.
  - Enforce strict contract + idempotency.

- `edge_runtime`
  - Route secure tasks to Edge Node.
  - Enforce local vault + sovereign controls.

---

## Control Plane Guardrails

- If tenant mode is `outreach`, hide runtime-only UI.
- Reject runtime tasks when `execution_mode` is incompatible.
- Log all cross-service task dispatch with correlation ID.
