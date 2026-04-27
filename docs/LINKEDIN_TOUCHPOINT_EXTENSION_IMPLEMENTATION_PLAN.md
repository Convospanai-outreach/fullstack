# LinkedIn Touchpoint Extension Implementation Plan

## Scope
- Touchpoint-only LinkedIn automation (no mass scraping).
- User selects cached LinkedIn profile URLs.
- Daily invite cap: 10-15 per user/account.
- Immediate hard-stop on verification prompts, warning banners, or invite limits.
- LinkedIn outcome feeds campaign sequencing and email follow-up in main app.

## Deployment Model
- Control Plane: `apps/web` + `apps/api`
- Execution Plane: Chrome extension (headless-assisted browser actions)
- Intelligence Plane: FastAPI/API enrichments (optional)
- Objective Plane: Meeting-booked conversion loop in main app

## Stage 0: Safety and Policy Baseline
1. Define explicit allowed actions:
   - `VISIT_PROFILE`
   - `SEND_CONNECT_INVITE`
   - `SEND_INMAIL`
2. Define forbidden actions:
   - bulk scraping
   - pagination crawl
   - hidden background autopilot
3. Add global kill switch env:
   - `LINKEDIN_AUTOMATION_ENABLED=false` by default
4. Add stop reasons enum:
   - `VERIFICATION_REQUIRED`
   - `INVITE_LIMIT_REACHED`
   - `WARNING_DETECTED`
   - `CHECKPOINT_DETECTED`
   - `MANUAL_STOP`

Acceptance:
- Automation cannot run unless explicitly enabled.
- Every blocked run has a machine-readable stop reason.

## Stage 1: Contracts (API <-> Extension)
1. Create outbox task contract:
   - task id, lead id, action type, personalized payload, policy envelope (cap/jitter/cooldown), idempotency key, expiry.
2. Create callback result contract:
   - task id, status, timestamp, evidence, stop reason, platform hint (if blocked), idempotency key.
3. Require signed callback:
   - short-lived token + signature + clock skew guard.
4. Enforce server-side idempotency for result ingestion.

Acceptance:
- Same callback replay does not duplicate action state.
- Unsigned/expired callbacks are rejected.

## Stage 2: Extension MVP (Private Folder Build)
1. Extension modules:
   - login/session check
   - safe selector runner
   - warning/checkpoint detector
   - rate/pacing controller
   - callback reporter
2. UI behavior:
   - user must click start
   - show daily cap usage
   - show hard-stop warning state
3. Guardrails in extension:
   - per-send randomized delay
   - session max actions
   - zero execution when verification/risk signals detected

Acceptance:
- Extension halts immediately on verification/warning.
- No autonomous run without explicit user start.

## Stage 3: API Integration in Monorepo
1. Queue + ingestion alignment:
   - unify current campaign job flow with extension task queue bridge.
2. Add strict state machine:
   - `QUEUED -> CLAIMED -> ATTEMPTED -> SENT|FAILED|BLOCKED -> FOLLOWUP_ELIGIBLE`
3. Persist action audit:
   - user/team/campaign/lead/task/status/stop_reason/redacted metadata
4. Add API endpoints:
   - fetch pending touchpoint tasks
   - post touchpoint results
   - post emergency stop event

Acceptance:
- Campaign queue and extension queue produce one consistent action timeline.
- Email follow-up cannot trigger without valid preceding LinkedIn state.

## Stage 4: Sequencing and Follow-up Logic
1. Follow-up gates:
   - only send email when LinkedIn step outcome is known and policy allows.
2. Personalization flow:
   - use approved templates + lead context + intelligence signals.
3. Timeout behavior:
   - if no callback in SLA window, mark as `UNKNOWN` and hold downstream actions.

Acceptance:
- No orphan email sends after failed/blocked LinkedIn steps.
- Unknown status leads do not auto-progress.

## Stage 5: Intelligence Sync and Feedback Loop
1. Store interaction intelligence:
   - accepted/ignored/replied/blocked/error categories.
2. Feed back to campaign tuning UI:
   - update messaging suggestions and step timing.
3. Add attribution fields:
   - action id -> follow-up email id -> meeting id.

Acceptance:
- Campaign editor can see LinkedIn outcomes and adapt messaging.
- Meeting outcomes can be traced back to touchpoint actions.

## Stage 6: Objective Tracking (Meeting Booking)
1. Add objective metrics:
   - invite sent rate
   - response rate
   - qualified reply rate
   - meeting booked rate
2. Prioritize optimizer decisions on meeting-booked KPI, not volume KPI.

Acceptance:
- Dashboard exposes meeting-focused conversion funnel.
- Optimization logic does not optimize only for send counts.

## Stage 7: Ops and Failure Handling
1. Hard-stop controls in admin:
   - account-level stop
   - campaign-level stop
   - global stop
2. Alerting:
   - notify when stop reasons spike.
3. Incident runbook:
   - how to resume safely after checkpoint/warning.

Acceptance:
- Ops can stop automation in one action.
- Resume requires explicit admin/user confirmation.

## Stage 8: Testing and Rollout
1. Unit:
   - state transitions, idempotency, stop reason logic.
2. Integration:
   - task issue -> extension callback -> follow-up eligibility.
3. Adversarial:
   - replay attacks
   - fake callback signatures
   - callback delay + duplication
4. Controlled rollout:
   - internal users only
   - cap at 5/day, then 10/day, then 15/day.

Acceptance:
- No duplicate sends under retries.
- No policy bypass under malformed callbacks.

## File-Level Implementation Targets (Monorepo)
- `apps/api/routes/queue/pending/route.ts`
- `apps/api/routes/queue/result/route.ts`
- `apps/api/routes/extension/*`
- `apps/api/src/lib/sequenceService.ts`
- `apps/api/workers/handlers/sequenceHandlers.ts`
- `apps/api/src/lib/campaignService.ts`
- `apps/web/src/app/(dashboard)/campaigns/*`
- `apps/web/src/app/(dashboard)/admin/health/page.tsx`

## Environment Variables
- `LINKEDIN_AUTOMATION_ENABLED=false`
- `LINKEDIN_DAILY_MAX_INVITES=15`
- `LINKEDIN_SESSION_MAX_ACTIONS=20`
- `LINKEDIN_STOP_ON_WARNING=true`
- `LINKEDIN_STOP_ON_VERIFICATION=true`
- `LINKEDIN_CALLBACK_MAX_SKEW_SECONDS=120`

## Rollout Recommendation
1. Implement Stage 0-3 first (safety + contracts + queue alignment).
2. Gate all mutation execution behind feature flag.
3. Enable Stage 4-6 after stable callback quality and low block rates.
4. Move to public Chrome Web Store distribution only after pilot telemetry is stable.

