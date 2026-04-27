# LinkedIn Touchpoint Pre-Implementation Swarm Report (2026-04-27)

## Objective
Validate the approach **before implementation** using:
1. baseline failure testing
2. multi-role swarm critique (user, admin, adversarial, DevOps, marketing head, IT head)
3. go/no-go gate for implementation start

## Baseline Test Results (local, no Docker)
- `npm run typecheck:api`: **PASS**
- `npm run build:api`: **PASS**
- `npm run typecheck:web`: **FAIL**
  - `Cannot find type definition file for '@playwright/test'`
  - `Cannot find type definition file for 'vitest/globals'`

Notes:
- This indicates Web typecheck environment/dependency drift that must be resolved before implementation gates can turn green.

## Swarm Roles and Conclusions

### 1) User Role
Main concern: trust and clarity.
- Cannot easily tell if system is ready/safe.
- Needs explicit cap visibility before send.
- Needs per-lead proof states and clear stop reasons.
- Must see meeting objective, not only activity volume.

### 2) Admin Role
Main concern: operator-grade controls missing.
- No LinkedIn-specific hard-stop wired on queue paths.
- Role checks too broad for extension execution.
- Raw payload logging/auditing without redaction bounds.
- Missing server-side daily cap/session cap enforcement.

### 3) Adversarial Role
Main concern: exploitable trust boundaries.
- Extension auth model is weak for public store distribution.
- Callback can be forged when `claimToken` is omitted.
- Queue poisoning risk if task payload allowlist is weak.
- Team assignment ambiguity in extension push route.
- Objective gaming possible without independent meeting verification.

### 4) DevOps Role
Main concern: reliability and consistency.
- Split-brain queue model (`agentTask` and `job`) causes inconsistency risk.
- `SEQUENCE_ACTION` scheduling and worker dispatch paths are not reliably aligned.
- Status taxonomy differs across routes and queue layers.
- Pause/rollback semantics are incomplete.

### 5) Marketing Head Role
Main concern: campaign quality and brand safety.
- Pilot scope is valid, but guardrails and measurement must be strict.
- Must optimize for qualified conversations/meetings, not invite count.
- Follow-up email must add value, not duplicate LinkedIn touchpoint.

### 6) IT Head Role
Main concern: enterprise readiness and operability.
- Shared extension key + session model is insufficient for enterprise posture.
- Data governance/provenance and tenant-isolation controls need tightening.
- Requires explicit operational controls, runbooks, and supportability model.

## Code-Level Risk Hotspots
- `apps/api/src/linkedin/puppeteerRunner.ts`
  - returns not configured runner response.
- `apps/api/routes/queue/pending/route.ts`
  - claims `agentTask` browser tasks.
- `apps/api/routes/queue/result/route.ts`
  - claim token currently optional; result semantics too loose.
- `apps/api/routes/extension/tasks/route.ts`
  - claims from `job` table (parallel queue model).
- `apps/api/routes/extension/tasks/complete/route.ts`
  - completion flow separate from queue/result path.
- `apps/api/routes/extension/push/route.ts`
  - writes to `teamIds[0]`, needs explicit active team binding.
- `apps/api/routes/extension/_lib/auth.ts`
  - extension auth posture needs hardening for web-store distribution.
- `apps/api/src/lib/campaignService.ts`
  - pause flow notes pending jobs are not canceled.
- `apps/api/workers/handlers/sequenceHandlers.ts`
  - requires stronger pause/quarantine checks and outcome gating.

## Go/No-Go
Status: **NO-GO for implementation start** (yet)

Reason:
- pre-implementation checks identified correctness/security/reliability blockers that can create account risk, state inconsistency, and unreliable objective tracking.

## Required Improvements Before Implementation
1. **Unify queue ownership**
   - choose one canonical execution contract for extension tasks/results.
2. **Make callback integrity strict**
   - mandatory one-time `claimToken`, replay-safe, expiry-bound.
3. **Enforce server-side guardrails**
   - daily cap, session cap, cooldown, and hard-stop lock states.
4. **Strengthen auth + tenancy**
   - explicit active `teamId`, stronger extension identity model.
5. **Redact + schema-bound logs**
   - no raw arbitrary payloads to logs/audit.
6. **Outcome state machine**
   - `QUEUED -> CLAIMED -> ATTEMPTED -> SENT|FAILED|BLOCKED -> FOLLOWUP_ELIGIBLE`
   - no follow-up when status is `UNKNOWN/BLOCKED/FAILED`.
7. **Meeting-objective verification**
   - do not count self-reported extension success as meeting success without independent evidence.
8. **Fix Web typecheck baseline**
   - resolve missing web type definitions so baseline checks are green.

## Stage-Gated Plan (strict order)
1. **Gate 0 - Baseline Green**
   - typecheck/build baselines pass.
2. **Gate 1 - Contract Hardening**
   - queue/result integrity, idempotency, and payload schemas.
3. **Gate 2 - Guardrail Enforcement**
   - cap/session/stop-lock logic on server.
4. **Gate 3 - Data and Tenant Safety**
   - explicit tenant binding, provenance, redaction.
5. **Gate 4 - Sequence + Follow-up Integrity**
   - ensure no orphan or unsafe follow-up transitions.
6. **Gate 5 - Swarm Validation (post-implementation)**
   - user/admin/adversarial/devops/marketing/IT role walkthroughs on implemented flow.
7. **Gate 6 - Pilot**
   - single internal account, low cap, monitored rollout.

## Decision
Proceed with **improvement phase first**, then implementation, then full swarm validation against acceptance tests.

