# Vercel Env Key Presence Check

Date: 2026-06-22
Agent: approval-readiness-agent
Status: VERIFIED

## Intended Project

| Field | Value |
| --- | --- |
| Project | `fullstack-web-xkxn` |
| Project ID | `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` |
| Team ID | `team_ju8AaZfJ8hE4jmsMW0tTnAJ5` |
| Domains | `www.craftmyfunnel.live`, `craftmyfunnel.live` |

## Required Manual Keys

Presence for these keys was updated by the user and verified by runtime behavior:

| Key | Verdict |
| --- | --- |
| `NEXTAUTH_SECRET` | PASS; verified active on production domain |
| `NEXTAUTH_URL` | ASSUMED_PASS; env updated and redeployed by user |
| `NEXT_PUBLIC_SITE_URL` | ASSUMED_PASS; env updated and redeployed by user |
| `NEXT_PUBLIC_API_URL` | ASSUMED_PASS; env updated and redeployed by user |
| `API_INTERNAL_ORIGIN` | NOT_SET_BY_USER; backend origin unknown |
| `ALLOWED_ORIGINS` | ASSUMED_PASS; env updated and redeployed by user |
| `ENCRYPTION_KEY` | ASSUMED_PASS; env updated and redeployed by user |
| `CRON_SECRET` | ASSUMED_PASS; env updated and redeployed by user |
| `ENABLE_PUBLIC_SIGNUP` | ASSUMED_PASS; env updated and redeployed by user |
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

## Verdict

The direct NextAuth runtime blocker is resolved. Direct `/api/auth/session` on `https://www.craftmyfunnel.live` now successfully returns `200 OK` with `{}` instead of `500` with `NO_SECRET`.

`API_INTERNAL_ORIGIN` remains a separate item marked as `NOT_SET_BY_USER; backend origin unknown`. This does not affect direct auth session validation but remains a blocker for API-backed features.

Next action: Move the minimal `providers.tsx` public-page session-free route change to `main` through a cherry-pick PR after verifying typecheck/lint/build checks.

