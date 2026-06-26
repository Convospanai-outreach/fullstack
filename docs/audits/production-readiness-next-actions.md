# Production Readiness Next Actions

Date: 2026-06-26
Branch: `docs/functional-readiness-reassessment`
Repository: `Convospanai-outreach/fullstack`

## Readiness verdict

CraftMyFunnel is **not yet production-ready**.

Functional production readiness remains the immediate focus. Security implementation should not start yet; PR #44 is still open and unmerged, and the current main branch does not yet contain the sequenced Stage 12A/12B security plan.

## Current status table

| Check | Current evidence | Status | Notes |
| --- | --- | --- | --- |
| Latest `main` SHA | `origin/main` is `88dd014a07c583ce2fd528dcee49c756d937cf6d` | VERIFIED | Fetched from GitHub before this docs update. |
| PR #44 merged? | `gh pr view 44` reports `state: OPEN`, `mergedAt: null`, `mergeCommit: null`, head `db1499ad3da9457b5aaefbda8c54015f82a37243` | NOT_MERGED | Do not treat Stage 12A/12B as present on main yet. |
| DB-health-green commit on main? | `git merge-base --is-ancestor 2a60a5926275efdbc95eb1df40197371a1004b76 origin/main` returned `NOT_ON_MAIN` | NOT_ON_MAIN | Commit exists on `docs/api-db-health-resolved`, not `main`. |
| Production `/api/health` documented as 200 on main? | Main docs still record `/api/health` as `503` with `checks.database: "down"` | NO | See `docs/audits/api-origin-production-health.md` and `docs/codex/VERIFICATION_MATRIX.md`. |
| Production `/api/health?probe=ready` documented as 200 on main? | Main docs still record readiness as `503` with `checks.database: "down"` | NO | The 200/up evidence exists only on off-main commit `2a60a59`. |
| `API_INTERNAL_ORIGIN` / Railway backend origin | Still documented as unresolved/not set | BLOCKED | Exact active Railway/custom API origin must be confirmed in dashboard before any env change. |
| Stale Railway checks as required checks | GitHub commit status for latest main still includes `illustrious-warmth` contexts, all success/no-op; GitHub required status checks API returns `404 Branch not protected` | NOT_REQUIRED_BY_API | Stale contexts still appear, but current API evidence does not show them as required checks. |
| Functional readiness blockers | DB/schema/auth/API-origin/Redis/deep-health/CI policy/feature-completeness items remain | NEEDS_REPLAN | Details below. |

## What is now resolved

| Area | Resolution evidence | Caveat |
| --- | --- | --- |
| PR #44 contents | PR #44 head `db1499ad3da9457b5aaefbda8c54015f82a37243` adds sequenced security hardening | Not merged to main yet. |
| GitHub Actions on latest main | Latest main workflow runs for `CI`, `Production Readiness Gate`, `Push on main`, `Vercel Parity Build`, and `Phi-3 Verification` are `success` | Does not prove live DB/schema or API-origin readiness. |
| Vercel status on latest main | Combined commit status includes `Vercel: success` | Vercel success does not prove app readiness. |
| Railway latest-main status contexts | `airy-balance` and `illustrious-warmth` contexts are all success/no-op on `88dd014` | `illustrious-warmth` still appears as stale context family. |
| Public/auth-session smoke from previous work | Existing docs record public pages and `/api/auth/session` improvements | Not sufficient for DB/schema/API-origin readiness. |

## What remains blocked

| Blocker | Evidence | Required next proof |
| --- | --- | --- |
| DB linkage proof beyond `SELECT 1` | Main docs still record readiness down; schema verifier has not run against production | Fresh non-mutating production readiness audit with redacted Vercel DB env target proof and read-only schema verifier output. |
| Supabase schema/migration proof | Live DB has 17 Prisma migration rows while local web/API migration directories exceed that; live verification blocked by credentials | Run read-only schema/migration verification with approved expected values; do not run migrations. |
| Web/API Prisma drift | Docs record prior convergence work, but live DB still lacks required auth/invite objects | Confirm canonical schema and live drift using the read-only verifier. |
| Clerk user/team linkage | Live DB missing `User.clerk_user_id`, `UserInvitation`, and `invite_requests` in main docs | Prove app DB user/team/invite readiness after schema strategy is resolved. |
| Redis/cache isolation | Redis env and namespace isolation remain not fully verified | Confirm Redis host/namespace fingerprints without secrets; verify degraded behavior remains intentional. |
| Health/smoke/deep readiness | Liveness passes, but main docs do not show readiness/deep health green | Re-run safe smoke and protected deep-health process only with approved access/secret handling. |
| `API_INTERNAL_ORIGIN` / Railway backend origin | Repo docs still show backend origin unknown | Confirm canonical Railway/custom HTTPS API origin in dashboard, then document safe fingerprint only. |
| CI gates | Main Actions are green, but production schema fingerprint/live drift and GHCR policy remain unresolved | Decide whether GHCR is required; add/verify live schema drift gate when credentials are available. |
| Feature completeness | Core app flows have not been re-proven after DB/API-origin readiness | Run documented smoke for signup/login, user/team linkage, campaign/lead/inbox paths after infrastructure blockers clear. |
| PR #6 | Existing docs say broad, mergeable=false, schema/env/docs/runtime overlap | Keep blocked; split only after canonical schema and migration strategy are stable. |

## DB-health-green branch decision

Do **not** merge or cherry-pick `docs/api-db-health-resolved` / commit `2a60a5926275efdbc95eb1df40197371a1004b76` as-is.

Recommendation: **supersede** it with a fresh production-readiness verification pass.

Reason:

- The commit is not on `main`.
- It changes readiness docs from DB `down` to DB `up`, but main still documents `/api/health` and `/api/health?probe=ready` as `503`.
- It does not resolve API origin, schema/migration proof, Clerk user/team linkage, Redis isolation, deep health, or PR #6.
- A fresh pass should capture current production evidence, with no secret values and no production mutation.

## Exact next 5 actions

1. Merge or close PR #44 intentionally. If merged, update the implementation map on main to include Stage 12A/12B; if not merged, keep functional readiness work independent of that pending docs PR.
2. Run a fresh non-mutating production health audit for `/api/health`, `/api/health?probe=ready`, and `/api/health?probe=live`; record whether DB readiness is currently `up` or `down` on main-era production.
3. Confirm Vercel Production `DATABASE_URL` and `DIRECT_URL` presence/target fingerprints plus canonical Supabase ref without exposing values; then run the read-only schema verifier with approved expected migration count/fingerprint.
4. Confirm the active Railway backend API service and exact public/custom HTTPS origin for `API_INTERNAL_ORIGIN`; document only the safe origin fingerprint and whether Vercel production is configured.
5. Rebaseline functional smoke after DB/API-origin proof: Clerk user/team linkage, Redis/cache namespace behavior, protected health/deep health, CI/live schema gates, and a small core feature smoke for leads/campaigns/inbox.

## PR #6 status

PR #6 remains blocked. It should not be merged as-is. Keep it split/blocked until:

- canonical schema ownership is proven
- live DB drift is verified
- migration safety is resolved
- API origin and env linkage are known
- functional smoke is green

## Clear readiness statement

Product status: **not production-ready**.

Controlled beta status: **not ready** until functional readiness is mostly green and, after PR #44 or equivalent sequencing is on main, the minimum security gate is completed.

Public/enterprise status: **not ready** until functional readiness, minimum beta gate, and deep security hardening are complete.

## Safety notes

This reassessment changed docs only. It did not change runtime code, DB schema, Prisma schema, migrations, Vercel/Supabase/Railway/Clerk/Upstash settings, OAuth scopes, Chrome extension permissions, secrets, env values, or PR #6.
