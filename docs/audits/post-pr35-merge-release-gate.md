# Post-PR35 Merge Release Gate Recheck

Date: 2026-06-23
Agent: post-pr35-release-gate-agent
Repository: `Convospanai-outreach/fullstack`
Latest main inspected: `e14806ca01439219fa3f93214acd07b1d3a9d042`

## Summary

PR #35 is merged into `main`. The requested main workflows are green, Vercel is green, the production public-page session smoke now passes, `/dashboard` still requires auth, `/p/*` public routing is preserved, and the root high-severity production audit gate passes.

Overall release status remains `NEEDS_REPLAN`. This is not a production-readiness claim.

## PR #35 Inclusion

Latest `origin/main` history:

```text
e14806c Merge pull request #35 from Convospanai-outreach/codex/repair-root-lockfile-npm-ci
de4d347 fix(ci): align public landing route guard
b08bf95 fix(ci): clear high security audit findings
ff381c9 chore(ci): repair root package lock for npm ci
```

Verdict: PR #35 is included in latest main.

## GitHub Actions On Main

GitHub Actions REST API for branch `main`, head `e14806ca01439219fa3f93214acd07b1d3a9d042`:

| Workflow | Run ID | Status | Conclusion | Notes |
| --- | --- | --- | --- | --- |
| `CI` | `28018282151` | completed | success | Web Build, API Strict Typecheck, and Docker Build Smoke jobs succeeded. |
| `Production Readiness Gate` | `28018282262` | completed | success | Production Stability Audit succeeded. |
| `Vercel Parity Build` | `28018282101` | completed | success | Root install, Prisma guard/generate, and exact Vercel web build succeeded. |
| `Phi-3 Verification` | `28018282099` | completed | success | Completed successfully. |

Additional workflow not in the requested list:

| Workflow | Run ID | Status | Conclusion | Failure |
| --- | --- | --- | --- | --- |
| `Register Docker Images to GHCR` | `28018282239` | completed | failure | `build-and-push` failed at `Build Web image (no push)` because Docker `next build` could not resolve `nodemailer` from `apps/web/src/lib/email/smtpClient.ts` via `apps/web/src/app/api/support/contact/route.ts`. |

Verdict: the requested Actions are green, but overall GitHub Actions are not fully green because the GHCR image workflow is failing.

## Commit Statuses

Combined commit status for `e14806ca01439219fa3f93214acd07b1d3a9d042`:

| Context | State | Notes |
| --- | --- | --- |
| `Vercel` | success | Deployment completed for latest main. |
| `airy-balance - convospan-api-split` | success | Railway API service green. |
| `airy-balance - convospan-full-scaffold` | pending | Railway full scaffold still pending. |
| `illustrious-warmth - convospan-api-split` | failure | Duplicate/stale Railway service still failing. |
| `illustrious-warmth - convospan-full-scaffold` | failure | Duplicate/stale Railway service still failing. |

Netlify status: no Netlify status context was present on the latest main commit. Prior PR #35 Netlify deploy preview was green before merge, but there is no applicable Netlify main status in the combined commit status payload.

Verdict: Vercel is green. Railway remains a release-gate blocker. Netlify is not applicable on the merge commit evidence available.

## Public Page Session Smoke

Checked production custom domain with Chromium using public Vercel DNS/SNI override:

`--host-resolver-rules=MAP www.craftmyfunnel.live 76.76.21.21,MAP craftmyfunnel.live 76.76.21.21`

| Path | HTTP status | Final URL | `/api/auth/session` requests | NextAuth/session console errors |
| --- | --- | --- | --- | --- |
| `/` | 200 | `https://www.craftmyfunnel.live/` | 0 | 0 |
| `/funnel` | 200 | `https://www.craftmyfunnel.live/funnel` | 0 | 0 |
| `/security` | 200 | `https://www.craftmyfunnel.live/security` | 0 | 0 |
| `/support` | 200 | `https://www.craftmyfunnel.live/support` | 0 | 0 |
| `/data-deletion` | 200 | `https://www.craftmyfunnel.live/data-deletion` | 0 | 0 |
| `/google-api-disclosure` | 200 | `https://www.craftmyfunnel.live/google-api-disclosure` | 0 | 0 |
| `/help` | 200 | `https://www.craftmyfunnel.live/help` | 0 | 0 |
| `/faq` | 200 | `https://www.craftmyfunnel.live/faq` | 0 | 0 |

Verdict: public pages no longer unnecessarily fetch `/api/auth/session`.

## Dashboard Auth Gate

| Path | HTTP status | Final URL | Verdict |
| --- | --- | --- | --- |
| `/dashboard` | 200 | `https://www.craftmyfunnel.live/login?callbackUrl=%2Fdashboard` | PASS: unauthenticated dashboard access redirects to login. |

## `/p/*` Public Routing

Source check:

- `apps/web/src/proxy.ts` includes `"/p"` in `publicPaths`.
- `apps/web/src/proxy.ts` includes `path.startsWith("/p/")` in `isPublic`.

Verdict: intended public `/p/*` behavior remains present.

## Security Audit

Command:

```powershell
npm audit --audit-level=high --omit=dev
```

Result: exit code `0`.

Remaining npm audit output contains 7 low/moderate findings:

- `@babel/core` low.
- `@opentelemetry/core` moderate.
- `dompurify` moderate.
- `next-auth` nested `uuid <11.1.1` moderate.

Verdict: high audit gate passes. Low/moderate dependency work remains for Stage 13.

## Remaining Blockers

- GHCR Docker image workflow fails on main because the web Docker build cannot resolve `nodemailer`. A focused Dockerfile hotfix is documented in `docs/audits/web-docker-nodemailer-build-fix.md`; GHCR still needs to be rerun and confirmed green.
- Railway commit statuses are not all green: two `illustrious-warmth` services fail and one `airy-balance` full scaffold status is pending.
- `API_INTERNAL_ORIGIN` remains unproven/not set.
- Live DB migration/schema drift remains unresolved.
- Live DB is still missing Clerk/invite schema required by application code.
- Unsafe `20260604140000_edge_runtime_pairing` migration still requires quarantine/replan before production migration.
- GitHub Dependabot/security alert mapping remains Stage 13 work even though `npm audit --audit-level=high --omit=dev` passes.
- PR #6 must not merge as-is.

## Safety Notes

No DB/schema/migration, Prisma schema, Supabase production data, Vercel/Railway/Clerk/Redis env, PR #6, OAuth scope, Chrome extension permission, LinkedIn automation, or UI changes were made.

This audit does not mark `PRODUCTION_READY` or `CONTROLLED_BETA_READY`.
