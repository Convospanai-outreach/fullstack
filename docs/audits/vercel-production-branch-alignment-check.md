# Vercel Production Branch Alignment Check

Date: 2026-06-22
Agent: approval-readiness-agent
Status: NEEDS_REPLAN

## Current Head

| Field | Value |
| --- | --- |
| Local branch | `codex/readiness-rebaseline-9788` |
| Tracked branch | `origin/codex/db-linkage-swarm-orchestration` |
| Current head checked | `94a23d55c0e9ce14e6593d5feb3c74e63d2db3d6` |
| Baseline requested by user | `9788d84db4afce78964aa9da90b22d606ef988a2` |

## Codex Branch Deployments

| Commit | GitHub/Vercel status | GitHub deployment | Environment | URL |
| --- | --- | --- | --- | --- |
| `94a23d55c0e9ce14e6593d5feb3c74e63d2db3d6` | `success`; Vercel description `Deployment has completed` | `5148021525` | `Preview` | `https://fullstack-web-xkxn-7cqon4bc4-convo2026s-projects.vercel.app` |
| `c3cbfbf48a353a3bf8ee1202b15cbb09e3f7632e` | `success`; Vercel description `Deployment has completed` | `5147717423` | `Preview` | `https://fullstack-web-xkxn-gjs0zzkhv-convo2026s-projects.vercel.app` |

Both checked Codex branch deployments are Preview deployments. They do not prove that `www.craftmyfunnel.live` is serving the same code.

## Production Domain Evidence

Fresh production runtime logs for the custom domain identify the serving deployment as:

| Field | Value |
| --- | --- |
| Project | `fullstack-web-xkxn` |
| Project ID | `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` |
| Production deployment observed in runtime logs | `dpl_8rrycQGHzaBXXPCkLQK2dS2fxWYH` |
| Domain | `www.craftmyfunnel.live` |
| Environment | `production` |
| Branch | `main` |
| Runtime log query evidence | NextAuth `NO_SECRET` on `/api/auth/session` and `/api/auth/_log` |

Latest GitHub Production deployment observed:

| Field | Value |
| --- | --- |
| GitHub deployment ID | `5147697018` |
| SHA/ref | `4367d7bc374d4a6db9151b00bc40078fca1e2416` |
| Environment | `Production` |
| Created at | `2026-06-22T07:27:20Z` |

The current Codex head is not the observed GitHub Production deployment.

## Vercel Project Metadata

Vercel project inspection returned:

| Field | Value |
| --- | --- |
| Project name | `fullstack-web-xkxn` |
| Project ID | `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` |
| Account/team ID | `team_ju8AaZfJ8hE4jmsMW0tTnAJ5` |
| Latest deployment ID | `dpl_CbD5LeM4MdHz8VAPVA9S6pkrE9qU` |
| Latest deployment URL | `fullstack-web-xkxn-7cqon4bc4-convo2026s-projects.vercel.app` |
| Latest deployment ready state | `READY` |
| Latest deployment target | `null` |
| Project live flag | `false` |

Configured domains include:

- `www.craftmyfunnel.live`
- `craftmyfunnel.live`
- `fullstack-web-xkxn-convo2026s-projects.vercel.app`
- `fullstack-web-xkxn-git-main-convo2026s-projects.vercel.app`

## Conclusion

The Codex branch is currently preview-only. The custom production domain is attached to the production `main` path, and runtime logs from that path still show `NEXTAUTH_SECRET` missing or unavailable.

Do not manually alias or promote the full Codex preview deployment as the safe default. This branch includes readiness documentation and broader work that is not proven by GitHub Actions on the current head.

## Recommended Safe Deployment Path

1. Add or verify `NEXTAUTH_SECRET` in Vercel Production for project `fullstack-web-xkxn` / `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8`, then redeploy Production.
2. Move only the minimal public-page session fix from `apps/web/src/app/providers.tsx` to the production branch `main` through a PR or cherry-pick PR.
3. Require GitHub Actions or equivalent lint/typecheck/build/test evidence to pass on the production-targeting commit before merge.
4. Re-run public custom-domain smoke for `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/funnel`, `/help`, and `/faq`.

If an urgent fix is needed, cherry-pick only the `providers.tsx` public session-free route change to `main` after review and checks. Do not change domain aliases as part of this docs-only pass.
