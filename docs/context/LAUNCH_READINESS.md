# Launch Readiness Checklist

## Pre-Deploy
- Run `scripts/verify_runtime_compatibility.ts`
- Run `scripts/verify_queue_health.ts`
- Run `scripts/reconcile_task_states.ts`
- Run `scripts/validate_pii_boundaries.ts`
- Run `scripts/detect_duplicate_mutations.ts`

## Deploy Order
1. Apply Prisma migration
2. Deploy control API + web
3. Deploy managed runtime API
4. Deploy edge node updates
5. Enable feature flags by tenant cohort

## Post-Deploy
- Run `scripts/check_failed_dispatches.ts`
- Verify `/health`, `/ready`, `/version`, `/capabilities` for all services
- Validate task success rate and latency metrics

## Rollback
- Disable new runtime dispatch flags
- Revert to legacy queue routing
- Roll back managed runtime route usage
