# PDCA Production Readiness Path To 100

## 1. Current Evidence Baseline

- Current date: `2026-07-06`
- Current branch: `docs/pdca-production-readiness-rebaseline`
- Latest `main` SHA: `334fa63d03aa86180dae3dfde4583b2996df1337`
- PR #63 status: `merged`
- PR #63 merge commit: `334fa63d03aa86180dae3dfde4583b2996df1337`
- Current GitHub Actions evidence on `main`:
  - `CI`: success
  - `Production Readiness Gate`: success
  - `Vercel Parity Build`: success
  - `Phi-3 Verification`: success
  - `Register Docker Images to GHCR`: in progress at the time of capture
- Open PRs that may affect readiness:
  - `#58` dependabot update, open
  - `#6` Gmail business mail control, open and still blocked
- Current product readiness statement: **not production-ready**
- Explicit note: Vercel `READY`, green CI, or a single green deployment lane does **not** prove production readiness. Readiness still requires live production health proof, API origin proof, DB drift proof, functional smoke proof, and operational signoff.

## 2. What Is Already Done

- Docker/GHCR/Trivy runtime package-manager cleanup is merged through PR #63.
- The current main branch has the Docker/GHCR cleanup and related release-gate checks merged, but the GHCR publish workflow was still running when this baseline was captured.
- Existing assessments still record local web gates as green in prior runs:
  - `npm run lint --workspace apps/web`
  - `npm run typecheck --workspace apps/web`
  - `npm run test:coverage --workspace apps/web`
  - `CI=true npm run test:e2e --workspace apps/web -- e2e/auth.spec.ts e2e/dashboard.spec.ts`
  - `npm run readiness:audit --workspace apps/api`
- Historical readiness docs show that production health, API origin, and schema drift have been partially proven in earlier phases, but those proofs are not sufficient as a current-main rebaseline.
- The repo already contains a read-only drift tooling pattern and a migration manifest shape:
  - `packages/db/prisma/schema.prisma` exists as the shared schema snapshot candidate.
  - `scripts/db/migration-manifest.schema.json` exists as an advisory rollout manifest format.

## 3. What Still Blocks 100/100

- Live production health and readiness endpoint proof
  - Evidence gap: fresh production `200` responses on current main for `/api/health` and `/api/health?probe=ready`.
- `API_INTERNAL_ORIGIN` / Railway backend origin proof
  - Evidence gap: a fresh, dashboard-confirmed canonical HTTPS backend origin for the production API, without exposing secret values.
- Supabase live DB schema and migration drift proof
  - Evidence gap: a read-only, current drift snapshot against the live database with no production mutation.
- Canonical Prisma schema decision
  - Evidence gap: one production-owned schema source of truth must be explicitly approved and documented.
- Missing auth/onboarding schema objects, if still documented
  - Evidence gap: current assessments still reference missing `User.clerk_user_id`, `UserInvitation`, and `invite_requests` objects in the live DB.
- Quarantined destructive EdgeNode migration path
  - Evidence gap: the `DELETE FROM "EdgeNode"` migration must remain quarantined until a reviewed, non-destructive replacement path is approved.
- Clerk user/team/invite functional proof
  - Evidence gap: end-to-end identity, team membership, and invite/onboarding flows must be re-proven on the current production baseline.
- Redis/cache isolation proof
  - Evidence gap: cache namespace, fallback behavior, and degraded-path behavior must be verified without exposing secrets.
- Protected/deep health proof
  - Evidence gap: protected readiness/deep-health behavior must be verified on the live environment, not just locally.
- Lead/campaign/inbox functional smoke
  - Evidence gap: core product flows need a fresh smoke run after the infrastructure baseline is re-established.
- Security risk acceptance
  - Evidence gap: dependency and application security findings need a current triage and acceptance record.
- Operational readiness, rollback, alerting, and runbooks
  - Evidence gap: survivability proof, owner mapping, and rollback/runbook currency need explicit signoff.
- Documentation drift
  - Evidence gap: older readiness docs still mix historical and current evidence; the next plan must re-baseline and de-duplicate them.

## 4. PDCA Cycle 1: Release Gate And Main Branch Proof

**PLAN**
- Confirm PR #63 is merged and reflected on `main`.
- Confirm latest `main` is green enough to be treated as the release baseline.
- Confirm GHCR/Trivy status for the current main commit.
- Confirm stale Railway/GitHub checks are not blocking release.

**DO**

```bash
git switch main
git pull --ff-only
gh pr view 63 --json number,state,isDraft,mergedAt,mergeCommit,url
gh run list --branch main --limit 10
gh pr list --state open --json number,title,headRefName,isDraft,mergeable,url
```

**CHECK**
- Pass if PR #63 is merged, `main` points to the expected merge commit, and all required release-gate checks are either green or explicitly non-blocking.
- Pass if the current `main` evidence shows no stale required Railway/GitHub checks blocking release.
- Fail if the GHCR/Trivy lane, merge gate lane, or any required main check remains unresolved without an explicit non-release explanation.

**ACT**
- If any of the above evidence is missing, open a docs-only follow-up PR that records the exact run IDs, commit SHA, and required-check state.
- Do not infer readiness from partially green release evidence.

## 5. PDCA Cycle 2: Production Health And API Origin Proof

**PLAN**
- Verify `/api/health` and `/api/health?probe=ready` on production.
- Confirm the canonical API backend origin from Railway or the controlling dashboard.
- Confirm whether `API_INTERNAL_ORIGIN` should be set and what it should point to.

**DO**

```bash
curl.exe -i https://www.craftmyfunnel.live/api/health
curl.exe -i "https://www.craftmyfunnel.live/api/health?probe=ready"
vercel env ls production
vercel env ls preview
```

- Do not print secret values.
- Do not set env values from this plan.
- If dashboard proof is required, manually confirm the active backend service origin and record only the host/origin fingerprint, not any secret material.

**CHECK**
- Pass if production health and readiness endpoints return the expected healthy result on the current deployment.
- Pass if the canonical API origin is confirmed from the controlling dashboard and the app env story is explicit.
- Fail if the environment story depends on guesswork, a localhost fallback, or an unverified private origin.

**ACT**
- If evidence is missing, open a fresh production health/API-origin evidence PR that records the exact URLs, status codes, and dashboard-confirmed origin fingerprint only.

## 6. PDCA Cycle 3: Read-Only DB Schema And Migration Drift Proof

**PLAN**
- Do not mutate production DB.
- Reconfirm live DB drift.
- Confirm canonical schema ownership.
- Keep the destructive EdgeNode migration quarantined.
- Prepare only a non-destructive migration sequence after approval.

**DO**

```bash
npm run db:schema:compare
npm run schema:verify:readonly
```

Inspect, but do not modify:

- `packages/db/prisma/schema.prisma`
- `apps/web/prisma/schema.prisma`
- `apps/api/prisma/schema.prisma`
- `scripts/db/migration-manifest.schema.json`

**CHECK**
- Pass if the live DB migration count is known, the latest migration is known, the schema fingerprint is known, and missing auth/invite objects are explicitly accounted for.
- Pass if no production migration was run and no production `prisma db push` was used.
- Fail if the canonical schema is still ambiguous or if the migration story relies on destructive cleanup in production.

**ACT**
- Open a docs-only PR that records the canonical schema decision and the non-destructive future migration sequence.
- Keep the EdgeNode cleanup path quarantined until a separate review explicitly approves a safer alternative.

## 7. PDCA Cycle 4: Functional Smoke Rebaseline

**PLAN**
- Reprove product flows after DB/API origin proof.

**DO**

```bash
npm run readiness:audit --workspace apps/api
npm run lint --workspace apps/web
npm run typecheck --workspace apps/web
npm run typecheck --workspace apps/api
npm run test:coverage --workspace apps/web
CI=true npm run test:e2e --workspace apps/web -- e2e/auth.spec.ts e2e/dashboard.spec.ts
```

Production/manual smoke flows to recheck:

- landing page
- login
- dashboard
- user/team linkage
- invite/onboarding path
- lead path
- campaign path
- inbox path
- protected health/deep health
- Redis/cache degraded behavior
- unauthorized metrics access

**CHECK**
- Pass if the listed flows work on the current baseline and the protected/deep endpoints behave as documented.
- Pass if Redis degradation is intentional and isolated, not a hidden hard dependency.
- Fail if any core flow still depends on stale hydration behavior, stale auth state, or unproven proxy/origin wiring.

**ACT**
- Open a functional smoke evidence PR that records the command outputs and the manual smoke outcomes.

## 8. PDCA Cycle 5: Security Risk Acceptance And Minimum Beta Gate

**PLAN**
- Security implementation only after functional readiness is mostly green.
- Minimum beta gate before controlled beta.
- No public production claim until all required gates are proven.

**DO**

```bash
npm audit --omit=dev --workspace apps/web
npm audit --omit=dev --workspace apps/api
```

Classify findings:

- critical: fix/block
- high: fix or formal acceptance with mitigation
- moderate: accept only with rationale if no safe upgrade
- dev-only: document why the finding is not runtime risk

**CHECK**
- Pass if critical and blocking high-severity findings are fixed or formally mitigated.
- Pass if any remaining moderate findings have a clear runtime-risk rationale and owner signoff.
- Fail if the security story is vague, unowned, or still mixing launch blockers with future hardening work.

**ACT**
- Create a security risk acceptance doc that lists each remaining advisory, its runtime relevance, mitigation, and owner.

## 9. PDCA Cycle 6: Operational Readiness And Rollback

**PLAN**
- Production must be survivable, not just deployable.

**DO**

Check or propose these runbooks:

- `docs/runbooks/deploy.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/failed-migration.md`
- `docs/runbooks/provider-outage.md`
- `docs/runbooks/incident-response.md`

Cover:

- alerting
- structured logs
- correlation IDs
- no secret leakage
- incident owner
- release owner
- dependency patch owner
- rollback owner

**CHECK**
- Pass if the system has a current rollback path, a clear incident chain, and runbooks that match how the app actually deploys and fails.
- Pass if logging and alerting are actionable without exposing secrets or private user data.
- Fail if operational ownership is implied but not documented.

**ACT**
- Publish an ops-readiness signoff doc that names owners, rollback steps, and the exact operational alerts that matter.

## 10. Final 100/100 Signoff Checklist

- [ ] Local gates green
- [ ] GitHub Actions green on PR branch
- [ ] GitHub Actions green on `main`
- [ ] Docker/GHCR/Trivy clean
- [ ] Production health green
- [ ] Readiness/deep health understood
- [ ] API origin verified
- [ ] DB schema drift verified read-only
- [ ] Canonical schema decision approved
- [ ] Migration strategy non-destructive and approved
- [ ] Auth/user/team/invite flows proven
- [ ] Lead/campaign/inbox flows proven
- [ ] Redis/cache behavior proven
- [ ] Security risk accepted or fixed
- [ ] Rollback tested or explicitly documented
- [ ] Runbooks current
- [ ] Docs aligned
- [ ] No inflated production claims

## 11. Immediate Next 5 Actions

Use this exact order unless current evidence proves one is already complete:

1. Confirm PR #63 merge and latest main green.
2. Freshly verify production `/api/health` and `/api/health?probe=ready`.
3. Confirm `API_INTERNAL_ORIGIN` / Railway backend origin without exposing secrets.
4. Run read-only DB schema/migration drift verification.
5. Rebaseline functional smoke for Clerk, user/team linkage, Redis/cache, protected health, lead, campaign, and inbox flows.

This document is planning and evidence management only. It does not change runtime code, DB schema, Prisma migrations, env values, or production systems, and it does not claim `PRODUCTION_READY` or `CONTROLLED_BETA_READY`.
