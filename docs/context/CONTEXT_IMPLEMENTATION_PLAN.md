# ConvoSpan Context Implementation Plan

## Purpose
Create a context-first, reusable implementation plan that keeps stabilization, product clarity, migration safety, and runtime split execution aligned across all phases.

## Phase 0: Context Baseline (2-3 days)
- Create `docs/context/` as the canonical architecture context folder.
- Add and maintain:
  - product modes
  - execution modes
  - service boundaries
  - compatibility matrix
  - freeze/deprecation list
- Add `docs/context/CONTEXT_DECISIONS.md` for decision log and deprecations.
- Output: one trusted source of architectural truth for product, engineering, and ops.

## Phase 1: Safety Rails (3-5 days)
- Add strict task contract with required fields:
  - `version`
  - `task_type`
  - `tenant_id`
  - `execution_mode`
  - `target_runtime`
  - `task_id`
  - `idempotency_key`
  - `created_at`
  - `expires_at`
  - `payload`
  - `policy`
  - `audit_context`
- Enforce job state machine and idempotency at queue entry and transitions.
- Add migration-safe Prisma fields/tables (nullable first, then backfill).
- Output: malformed tasks blocked early; duplicate mutation risk reduced.

## Phase 2: Runtime Routing Control (3-4 days)
- Centralize routing logic in `runtime_control`.
- Implement required execution routing:
  - `saas_only`
  - `managed_runtime`
  - `edge_runtime`
- Add compatibility checks before dispatch.
- Output: no ad-hoc runtime routing spread across modules.

## Phase 3: Managed Runtime API (5-7 days)
- Build `services/managed-runtime-api` (FastAPI) with:
  - `/health`
  - `/ready`
  - `/version`
  - `/capabilities`
  - `/v1/tokenize`
  - `/v1/generate`
  - `/v1/classify`
  - `/v1/execute`
- Add signed service-to-service auth and strict request validation.
- Output: heavy AI/runtime concerns isolated from SaaS control plane.

## Phase 4: Product Mode Separation (4-6 days)
- Add explicit product mode gates:
  - `outreach`
  - `runtime`
- Gate UI + API + worker behavior by product and execution mode.
- Keep edge optional, exposed as premium execution mode.
- Output: clean product narrative and reduced UX confusion.

## Phase 5: Reuse + Cleanup (4-6 days)
- Consolidate duplicate AI/dispatch paths.
- Rename ambiguous labels to explicit service names.
- Freeze non-core expansion:
  - DAG/workflow expansion
  - graph complexity
  - stealth/scraping expansion
  - multi-channel sprawl
- Output: simpler, maintainable, bounded codebase.

## Phase 6: Reliability + Observability (3-5 days)
- Add structured logs and correlation IDs across services.
- Enforce retries by task class and DLQ handling.
- Add stuck-job detection and retry-storm prevention.
- Add operational self-check scripts:
  - `verify_runtime_compatibility`
  - `verify_queue_health`
  - `reconcile_task_states`
  - `detect_duplicate_mutations`
  - `validate_pii_boundaries`
  - `check_failed_dispatches`
- Output: operational confidence and recoverability.

## Phase 7: Launch Readiness (2-3 days)
- Canary rollout by tenant cohorts.
- Post-deploy checks and failure drills.
- Rollback rehearsal before full cutover.
- Output: controlled transition to cloud-first + edge-optional architecture.

## Success Criteria
- No duplicate execution of unsafe mutating tasks.
- Malformed or incompatible tasks never reach `running`.
- Outreach tenants do not see runtime-only complexity.
- Managed runtime works reliably when edge is unavailable.
- India core remains simple; upsells stay modular and meterable.

