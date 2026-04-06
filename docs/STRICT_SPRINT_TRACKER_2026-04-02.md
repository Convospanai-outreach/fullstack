# Strict Sprint Tracker (2026-04-02)

## Operating Rules
1. No item is complete without evidence (test/log/command output link).
2. `B01` and `B02` are hard gates for all downstream implementation.
3. One owner cannot run more than one `in_progress` item.
4. Use absolute file-path references in every completion note.

## Sprint 1 (Security + Reproducibility Gate)

- [ ] `B01` Atomic extension task claim + lease + idempotent completion
  - Owner: `debugger_specialist`
  - Support: `devops_engineer`, `technical_auditor`
  - Depends on: none
  - Acceptance:
    - concurrent poller test shows no duplicate execution
    - stale `processing` recovery verified
    - completion path idempotent under retries
  - Evidence:
    - Command output:
    - Files changed:

- [ ] `B02` Harden extension auth (short-lived token issuance + strict verification)
  - Owner: `technical_auditor`
  - Support: `admin_operator`, `debugger_specialist`
  - Depends on: none
  - Acceptance:
    - no production trust on `x-user-id`
    - token expiry/audience enforced
    - auth failure telemetry visible
  - Evidence:
    - Command output:
    - Files changed:

- [ ] `B03` Commit/runtime-gate critical helper files
  - Owner: `devops_engineer`
  - Support: `research_analyst`
  - Depends on: none
  - Acceptance:
    - clean clone build reproducible
    - CI preflight fails when helper files missing
  - Evidence:
    - Command output:
    - Files changed:

- [ ] `B04` Align Docker Compose web runtime command
  - Owner: `devops_engineer`
  - Support: `debugger_specialist`
  - Depends on: `B03`
  - Acceptance:
    - `docker compose up` boots web without manual patching
  - Evidence:
    - Command output:
    - Files changed:

- [ ] `B05` Deterministic API image build (`npm ci` + lockfile)
  - Owner: `devops_engineer`
  - Support: `technical_auditor`
  - Depends on: `B03`
  - Acceptance:
    - API image build uses lockfile path
    - repeated CI builds are deterministic
  - Evidence:
    - Command output:
    - Files changed:

## Sprint 2 (Control Plane + Concurrency)

- [ ] `B06` Fix governance read/write permission asymmetry
  - Owner: `admin_operator`
  - Support: `technical_auditor`
  - Depends on: `B01`, `B02`

- [ ] `B07` Tighten audit visibility for low-privilege roles
  - Owner: `admin_operator`
  - Support: `technical_auditor`
  - Depends on: `B01`, `B02`

- [ ] `B08` Remove queue check-then-act races
  - Owner: `debugger_specialist`
  - Support: `devops_engineer`
  - Depends on: `B01`

- [ ] `B09` De-duplicate TOON into shared module/package
  - Owner: `research_analyst`
  - Support: `technical_auditor`, `debugger_specialist`
  - Depends on: `B03`

- [ ] `B10` Reduce API eager import startup fragility
  - Owner: `debugger_specialist`
  - Support: `devops_engineer`
  - Depends on: `B05`

## Sprint 3 (Product Flow + Runtime Safety)

- [ ] `B11` Persist onboarding state step-by-step
  - Owner: `user_simulator`
  - Support: `admin_operator`
  - Depends on: `B01`, `B02`

- [ ] `B12` Robust signup recovery path
  - Owner: `user_simulator`
  - Support: `debugger_specialist`
  - Depends on: `B01`, `B02`

- [ ] `B13` Strict readiness vs liveness split by environment
  - Owner: `devops_engineer`
  - Support: `technical_auditor`
  - Depends on: `B05`

- [ ] `B14` Proxy relay allowlist hardening
  - Owner: `technical_auditor`
  - Support: `debugger_specialist`
  - Depends on: `B02`

- [ ] `B15` One-click extension connect bootstrap
  - Owner: `user_simulator`
  - Support: `admin_operator`, `debugger_specialist`
  - Depends on: `B02`

## Sprint 4 (UX Completion + CI Closure)

- [ ] `B16` Reduce dashboard cognitive overload
  - Owner: `user_simulator`
  - Support: `research_analyst`
  - Depends on: `B11`, `B12`

- [ ] `B17` Support flow ticketing/status UX
  - Owner: `admin_operator`
  - Support: `user_simulator`
  - Depends on: `B11`

- [ ] `B18` Fill CI/CD gate gaps (API+edge smoke, blocking verify)
  - Owner: `devops_engineer`
  - Support: `technical_auditor`
  - Depends on: `B05`, `B10`, `B13`

- [ ] `B19` Repo hygiene guardrails for generated artifacts
  - Owner: `devops_engineer`
  - Support: `research_analyst`
  - Depends on: `B03`, `B18`

## Signoff Checklist (per item)
- [ ] Owner implementation complete
- [ ] Tests/validation passed
- [ ] Security/ops signoff if applicable
- [ ] Evidence linked
- [ ] Regressions checked
