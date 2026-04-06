# Kanban Execution Board (2026-04-02)

## Scope
Strict backlog board derived from the 19 approved items.

## Backlog Key
- `B01` Atomic extension task claim + lease + idempotent completion
- `B02` Harden extension auth (short-lived token model)
- `B03` Commit/runtime-gate critical helper files
- `B04` Align Docker Compose web command with actual runtime
- `B05` Deterministic API container builds (`npm ci` + lockfile)
- `B06` Fix governance `GET/PUT` permission asymmetry
- `B07` Tighten audit visibility for low-privilege roles
- `B08` Remove queue check-then-act races
- `B09` De-duplicate TOON into shared module/package
- `B10` Reduce API eager route import startup fragility
- `B11` Persist onboarding state step-by-step
- `B12` Add robust signup recovery path
- `B13` Split strict readiness vs liveness by environment
- `B14` Restrict proxy relay scope (route/header allowlist)
- `B15` One-click extension connect bootstrap
- `B16` Reduce dashboard cognitive overload
- `B17` Support flow: ticket ID + status + inline errors
- `B18` Fill CI/CD gate gaps (API/edge smoke + blocking verify)
- `B19` Repo hygiene policy for generated artifacts

## Owner Lanes

| Owner | Now | Next | Later |
|---|---|---|---|
| `technical_auditor` | `B02` (signoff), `B05` (supply-chain signoff) | `B06`, `B07`, `B14` | `B13` |
| `debugger_specialist` | `B01` | `B08`, `B10` | `B12` (support) |
| `devops_engineer` | `B03`, `B04`, `B05` | `B10` (startup smoke), `B18` prep | `B13`, `B18`, `B19` |
| `admin_operator` | `B02` (policy support) | `B06`, `B07` | `B17` |
| `research_analyst` | `B03` dependency map | `B09` decomposition | `B16` telemetry framing |
| `user_simulator` | Input-only acceptance criteria for `B02` UX impact | Define acceptance for `B11`, `B12` | Execute `B11`, `B12`, `B15`, `B16`, `B17` |

## Columns

### Now (Sprint 1)
- `B01`, `B02`, `B03`, `B04`, `B05`

### Next (Sprint 2)
- `B06`, `B07`, `B08`, `B09`, `B10`

### Later (Sprint 3-4)
- `B11`, `B12`, `B13`, `B14`, `B15`, `B16`, `B17`, `B18`, `B19`

## Strict WIP Rules
- Max 1 `in_progress` item per owner at a time.
- No `Next` work starts until both `B01` and `B02` are accepted.
- Security-impacting items require `technical_auditor` signoff before moving to `Done`.
- Deploy-impacting items require `devops_engineer` signoff before moving to `Done`.
- User-facing flow items require `user_simulator` acceptance check.
