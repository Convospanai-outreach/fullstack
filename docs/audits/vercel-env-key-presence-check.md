# Vercel Env Key Presence Check

Date: 2026-06-22
Agent: approval-readiness-agent
Status: BLOCKED_EXTERNAL_ACCESS

## Intended Project

| Field | Value |
| --- | --- |
| Project | `fullstack-web-xkxn` |
| Project ID | `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` |
| Team ID | `team_ju8AaZfJ8hE4jmsMW0tTnAJ5` |
| Domains | `www.craftmyfunnel.live`, `craftmyfunnel.live` |

The Vercel connector can read project metadata and runtime logs for this project, but the exposed connector tools do not include environment-variable listing.

## Local CLI Attempt

`npx vercel env ls production --scope convo2026s-projects`

Result:

`Error: The specified scope does not exist`

`npx vercel env ls production --scope team_ju8AaZfJ8hE4jmsMW0tTnAJ5`

Result:

`Error: The specified scope does not exist`

`npx vercel env ls production`

Result:

`No Environment Variables found for siddharths-projects-0e516184/fullstack`

The local `.vercel/project.json` points to a different local project (`fullstack`, project ID `prj_mepPeOElVKkvK715R40uGahoyQWW`) and cannot prove env-key presence for `fullstack-web-xkxn`.

## Required Manual Keys

Presence for these keys remains unverified:

| Key | Verdict |
| --- | --- |
| `NEXTAUTH_SECRET` | MISSING_OR_UNVERIFIED; runtime logs show NextAuth `NO_SECRET` |
| `NEXTAUTH_URL` | UNVERIFIED |
| `NEXT_PUBLIC_SITE_URL` | UNVERIFIED |
| `NEXT_PUBLIC_API_URL` | UNVERIFIED |
| `API_INTERNAL_ORIGIN` | UNVERIFIED |
| `ALLOWED_ORIGINS` | UNVERIFIED |
| `ENCRYPTION_KEY` | UNVERIFIED |
| `CRON_SECRET` | UNVERIFIED |
| `ENABLE_PUBLIC_SIGNUP` | UNVERIFIED |
| `GOOGLE_CLIENT_ID` | UNVERIFIED |
| `GOOGLE_CLIENT_SECRET` | UNVERIFIED |
| `SMTP_FROM_NAME` | UNVERIFIED |
| `SMTP_FROM_EMAIL` | UNVERIFIED |
| `SMTP_HOST` | UNVERIFIED |
| `SMTP_PORT` | UNVERIFIED |
| `SMTP_SECURE` | UNVERIFIED |
| `SMTP_USER` | UNVERIFIED |
| `SMTP_PASSWORD` | UNVERIFIED |
| `GOOGLE_API_KEY` or `GEMINI_API_KEY` | UNVERIFIED |
| `OPENAI_API_KEY` | UNVERIFIED |

Marketplace-managed Supabase/Postgres, Redis/Upstash, GitHub, and Clerk keys were intentionally excluded from the manual-key list.

## Verdict

Env-key presence remains `BLOCKED_EXTERNAL_ACCESS`. The strongest available evidence is runtime logs showing `NEXTAUTH_SECRET` is missing or unavailable to the deployed NextAuth route.

Fresh post-deploy smoke for `c3cbfbf` still shows direct `/api/auth/session` returning `500`, and Vercel production runtime logs still show NextAuth `NO_SECRET` on `/api/auth/session` and `/api/auth/_log`.

The current checked head `94a23d55c0e9ce14e6593d5feb3c74e63d2db3d6` has a successful Vercel Preview deployment, but production runtime logs for `www.craftmyfunnel.live` still identify the serving path as environment `production`, branch `main`, deployment `dpl_8rrycQGHzaBXXPCkLQK2dS2fxWYH`, with NextAuth `NO_SECRET`.

Next action: use Vercel dashboard/API/CLI access scoped to team `team_ju8AaZfJ8hE4jmsMW0tTnAJ5` and project `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` to verify key presence without printing values across Production and Preview scopes. Add or repair `NEXTAUTH_SECRET` in Production, then redeploy Production before rechecking direct `/api/auth/session`.
