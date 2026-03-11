# ConvoSpan Production Rollback Runbook

## 🚨 Emergency Trigger Criteria
Initiate a rollback if any of the following occur after a deployment:
1. **Critical AI Failure**: Sovereign AI router fails to block PII (leaking to cloud).
2. **Data Loss**: Correlation IDs are missing from Audit Logs for >5% of requests.
3. **Availability**: Global error rate (5xx) exceeds 1% for more than 2 minutes.
4. **Performance**: Redis cache hit rate drops below 50% causing DB saturation.

---

## Phase 1: Immediate Triage
### 1. Stop the Bleeding
If the issue is related to a specific feature flag, disable it via the Admin UI or directly in Redis:
```powershell
# Disable a specific feature flag (e.g., Sovereign Automation)
redis-cli SET ff:global:linkedin_automation false
```

### 2. Verify Database Stability
Check for blocked processes or deadlocks:
```sql
SELECT * FROM pg_stat_activity WHERE wait_event IS NOT NULL;
```

---

## Phase 2: Rollback Procedures

### Strategy A: Docker Image Rollback (Recommended)
1. **Identify the last stable image tag** (e.g., `v1.2.3`).
2. **Update the Deployment Environment**:
```bash
# Update Docker Compose or K8s manifest
docker-compose pull
docker-compose up -d --no-deps web worker
```

### Strategy B: Database Migration Reversal
> [!CAUTION]
> Only perform if the deployment included a breaking schema change.
1. **Check Migration Status**:
```bash
npx prisma migrate status
```
2. **Rollback to Previous Shadow State**:
```bash
# Note: Prisma migrate down is not natively supported. 
# Use a manual SQL script from the `prisma/migrations` folder of the stable version.
psql -d convospan -f ./migrations/stable_state_reverter.sql
```

---

## Phase 3: Post-Rollback Verification
1. **Run Readiness Audit**:
```bash
npx tsx src/scripts/validate-production-readiness.ts
```
2. **Monitor Error Logs**:
```bash
tail -f logs/production.log | grep "ERROR"
```
3. **Validate Sovereign Routing**:
Test a PII request to ensure it fails-closed correctly.

---

## Phase 4: Incident Review
1. Open a post-mortem issue in GitHub.
2. Attach the `x-correlation-id` traces related to the failure.
3. Review `SentinelService` logs for early warning signs missed.

---
**Last Updated**: 2026-03-11
**Custodian**: Platform Engineering / Compliance Officer
