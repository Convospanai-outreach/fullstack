# Role Execution Order (6 Active Agents)

## Active Agents
- `user_simulator`
- `admin_operator`
- `technical_auditor`
- `debugger_specialist`
- `devops_engineer`
- `research_analyst`

## Execution Mode
- Strict serial gates for P0, then controlled parallelism for P1/P2.
- Max one active implementation thread per owner.

## Phase 0: Preflight (Day 0)
1. `research_analyst`
- Deliver dependency map for `B01..B05` and identify required repo-local support files.
- Output: dependency graph + risk notes.

2. `technical_auditor`
- Publish security acceptance criteria for `B01` and `B02`.
- Output: pass/fail checklist for auth + task safety.

3. `devops_engineer`
- Prepare reproducible validation command set for clean-clone checks.
- Output: preflight command list and expected outputs.

Gate to Phase 1: all three outputs complete.

## Phase 1: Hard Gate Implementation (Sprint 1)
1. `debugger_specialist` executes `B01`
- Handoff to `technical_auditor` for race/idempotency verification.

2. `technical_auditor` executes `B02`
- Handoff to `debugger_specialist` for runtime regression check.

3. `devops_engineer` executes `B03`, then `B04`, then `B05`
- `B03` must be done before `B04/B05`.

Parallel allowed in Phase 1:
- `devops_engineer` may run `B03` while `B01/B02` are in progress.
- `B04/B05` start only after `B03` complete.

Gate to Phase 2:
- `B01` and `B02` accepted by `technical_auditor`.
- `B03` accepted by `devops_engineer`.

## Phase 2: Control Plane + Concurrency (Sprint 2)
1. `admin_operator` executes `B06`, then `B07`.
2. `debugger_specialist` executes `B08`, then `B10`.
3. `research_analyst` leads `B09` extraction plan and implementation support.
4. `technical_auditor` signs off `B06/B07/B09` security/compliance impact.
5. `devops_engineer` validates startup/build impacts from `B10`.

Gate to Phase 3:
- `B06..B10` complete with regression evidence.

## Phase 3: Product Runtime + UX Foundations (Sprint 3)
1. `user_simulator` executes `B11`, then `B12`.
2. `technical_auditor` executes `B14`.
3. `devops_engineer` executes `B13`.
4. `user_simulator` executes `B15` after `B12`.
5. `admin_operator` reviews support and governance side-effects.

Gate to Phase 4:
- onboarding/signup/connect flows pass acceptance scenarios.

## Phase 4: UX Completion + Release Closure (Sprint 4)
1. `user_simulator` executes `B16`.
2. `admin_operator` executes `B17`.
3. `devops_engineer` executes `B18`, then `B19`.
4. `technical_auditor` final release risk signoff.
5. `research_analyst` publishes impact summary and follow-on opportunities.

## Handoff Protocol (mandatory)
For each backlog item handoff:
1. Problem + scope summary (3 lines max)
2. Files touched/inspected
3. Validation commands and outputs
4. Residual risks
5. Explicit accept/reject decision by reviewer role

## Stop Conditions
- Any security regression in `B01/B02/B14` => immediate halt and rollback plan.
- Any deployment reproducibility failure in `B03/B05/B18` => freeze feature work.
- Any unresolved P0/P1 blocker => no Sprint 3/4 start.
