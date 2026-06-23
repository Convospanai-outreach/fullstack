# Next Phased Production Improvements

Date: 2026-06-23
Issue: #38
Status: Planning only

This plan starts after CI/deploy gate cleanup. It does not authorize production migrations, production data changes, secret/env changes, or merging PR #6 as-is.

## Phase 1: Release Gate Cleanup

Goals:

- Remove stale `illustrious-warmth` checks from required GitHub checks.
- Confirm `airy-balance` is the canonical Railway project.
- Confirm GHCR `build-and-push` policy: required release gate or optional image publication.
- Verify latest `main` has no stale duplicate Railway failures after dashboard cleanup.

Evidence to collect:

- Latest `main` combined commit status.
- Latest `main` GitHub check-runs.
- Branch protection required status checks from GitHub UI or authenticated API.
- Railway dashboard proof that only active services are connected to GitHub deploy/status triggers.

Exit criteria:

- No stale `illustrious-warmth` contexts are required for merge/release.
- New commits no longer receive stale `illustrious-warmth` statuses.
- Active `airy-balance` statuses are understood and intentionally required or intentionally optional.
- GHCR policy is explicitly documented.

## Phase 2: API Origin And Proxy Readiness

Goals:

- Confirm exact production backend API origin from the active Railway API service or custom API domain.
- Document whether `API_INTERNAL_ORIGIN` should be set in Vercel Production.
- Do not guess or set env values from code alone.
- Verify `/api/proxy` does not recurse and points to the correct backend when configured.

Evidence to collect:

- Active Railway API service domain or approved custom API domain from dashboard.
- Vercel Production env key presence, without printing secret values.
- Source-level proxy behavior review.
- Runtime smoke for representative proxied API routes after env confirmation.

Exit criteria:

- Canonical API origin is documented.
- `API_INTERNAL_ORIGIN` decision is explicit.
- Proxy recursion risk is ruled out or fixed in a focused PR.

## Phase 3: Production Smoke And Approval-Route Validation

Goals:

- Re-run custom-domain smoke on `https://www.craftmyfunnel.live`.
- Confirm public pages render with no login redirect.
- Confirm public pages no longer emit unnecessary `/api/auth/session` client calls.
- Confirm approval/legal pages show correct support email and no old email values.

Pages:

- `/`
- `/funnel`
- `/security`
- `/support`
- `/data-deletion`
- `/google-api-disclosure`
- `/help`
- `/faq`
- `/privacy`
- `/terms`
- `/contact`

Exit criteria:

- Required public/approval pages return public HTTPS `200`.
- No checked public page redirects to login.
- No checked public page emits avoidable `/api/auth/session` client fetch noise.
- `support@craftmyfunnel.live` appears where expected and old support emails are absent.

## Phase 4: Database Schema Readiness Without Production Mutation

Goals:

- Do not run production migrations.
- Reconfirm current live DB drift evidence.
- Prepare a non-destructive migration sequencing plan for missing Clerk/invite schema.
- Keep destructive `DELETE FROM "EdgeNode"` migration quarantined until separately reviewed.

Evidence to collect:

- Read-only live schema verification output.
- Current Prisma schema comparison output.
- Additive migration sequencing plan for missing `User.clerk_user_id`, `UserInvitation`, and `invite_requests`.
- Separate review plan for the `20260604140000_edge_runtime_pairing` destructive migration.

Exit criteria:

- Live DB drift is current and evidence-backed.
- Additive migration order is reviewed before any production execution.
- Destructive migration remains quarantined until explicitly approved.

## Phase 5: PR #6 Decomposition

Goals:

- Do not merge PR #6 as-is.
- Split PR #6 into small reviewable PRs.
- Ensure each slice has validation and no cross-cutting schema/env surprises.

Slices:

- Schema-safe slice.
- Gmail/mailbox control slice.
- UI slice.
- API integration slice.
- Docs/audit slice.

Exit criteria:

- Each slice has a narrow owner, scope, and validation plan.
- Schema/env impacts are isolated and documented.
- No slice depends on hidden dashboard changes.

## Phase 6: Controlled Beta Readiness Package

Goals:

- Produce a final readiness matrix.
- List all still-blocking external dashboard values.
- List launch blockers vs beta blockers.
- Do not claim production readiness unless every gate is green and DB/env blockers are resolved.

Exit criteria:

- Release checks are green or explicitly risk-accepted by owner.
- DB/schema readiness has non-destructive evidence.
- Required env/dashboard values are confirmed.
- Remaining blockers are classified as launch-blocking, beta-blocking, or follow-up.

## Standing Constraints

- Do not touch DB schema or create Prisma migrations without explicit approval.
- Do not run production migrations.
- Do not change Supabase production data.
- Do not change Vercel/Railway/Clerk/Redis env values or secrets from code.
- Do not broaden OAuth scopes, Chrome extension permissions, or LinkedIn automation.
- Do not merge PR #6 as-is.
- Do not mark `PRODUCTION_READY` or `CONTROLLED_BETA_READY` until every required gate is proven green and remaining blockers are resolved.
