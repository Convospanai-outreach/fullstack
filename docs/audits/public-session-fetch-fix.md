# Public Session Fetch Fix

Date: 2026-06-22
Agent: approval-readiness-agent
Status: NEEDS_REPLAN

## Root Cause

Public marketing, help, trust, and approval pages were allowed by `apps/web/src/proxy.ts`, but the global web app provider in `apps/web/src/app/providers.tsx` only skipped NextAuth `SessionProvider` for a smaller route set.

When pages such as `/funnel`, `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` mounted `SessionProvider`, NextAuth client code fetched `/api/auth/session`. Production runtime evidence showed that endpoint returning `500` with NextAuth `NO_SECRET`, and repeated client error logging also produced `429` noise.

The static audit found no direct `next-auth/react`, `useSession`, `getSession`, or `SessionProvider` imports in the public page components or shared public navigation components. NextAuth client usage remains in authenticated/legacy areas such as `settings/general`, `client`, and API/admin compatibility routes.

## Files Changed

- `apps/web/src/app/providers.tsx`
- `docs/audits/public-session-fetch-fix.md`

## Why The Fix Is Safe

The change only expands the route prefixes where the global client provider returns children without mounting NextAuth `SessionProvider`.

Protected app routes are not added to the session-free list. Dashboard, admin, settings, campaigns, inbox, workflows, leads, billing, and other authenticated areas still receive the existing provider behavior and are still protected by route-level auth/proxy logic.

This does not remove NextAuth, Clerk, middleware/proxy protection, RLS assumptions, API auth checks, or any legacy compatibility route.

## How Public Pages Avoid `/api/auth/session`

`apps/web/src/app/providers.tsx` now treats these public route prefixes as session-free:

- `/`
- `/about`
- `/contact`
- `/pricing`
- `/funnel`
- `/help`
- `/faq`
- `/privacy`
- `/terms`
- `/security`
- `/support`
- `/data-deletion`
- `/google-api-disclosure`
- `/p`
- `/login`
- `/agent-login`
- `/client-login`
- `/signup`
- `/accept-invite`
- `/verify-email`
- `/forgot-password`
- `/magic-link`

For those paths, the app does not mount NextAuth `SessionProvider`, so the provider cannot trigger the automatic `/api/auth/session` client fetch.

## Commands Run And Results

| Command | Result |
| --- | --- |
| `rg -n --glob "*.tsx" --glob "*.ts" "SessionProvider|useSession|getSession|next-auth/react|signIn\\(|signOut\\(|getServerSession" apps/web/src/app apps/web/src/components` | Found NextAuth client/server usage in protected or legacy surfaces; public pages and public shared nav did not directly import session client code. |
| `rg -n "next-auth/react|useSession|getSession|SessionProvider" apps/web/src/app/page.tsx apps/web/src/app/funnel apps/web/src/app/security apps/web/src/app/support apps/web/src/app/data-deletion apps/web/src/app/google-api-disclosure apps/web/src/app/help apps/web/src/app/faq apps/web/src/components/Header.tsx apps/web/src/components/Nav.tsx apps/web/src/components/Footer.tsx apps/web/src/components/ui/NotificationBell.tsx` | No matches. |
| `Get-Content apps/web/src/app/providers.tsx` | Confirmed global `SessionProvider` wrapping was controlled by route-prefix allowlist. |
| `npm run typecheck --workspace apps/web` | Passed. |

No production build was run for this focused fix; the required workspace typecheck passed.

## Remaining Risks

Direct `/api/auth/session` can still fail in Production until `NEXTAUTH_SECRET` is present in the correct Vercel Production environment. This fix prevents unnecessary public-page fetches; it does not repair the server-side NextAuth environment.

Production readiness is not claimed. GitHub Actions and live custom-domain smoke must still prove the behavior after deployment to the production branch/domain.

## Explicit Non-Changes

No DB schema edits, Prisma migrations, Supabase production changes, Redis changes, Clerk dashboard changes, Vercel environment changes, production secret changes, PR #6 changes, destructive SQL, or security-check disabling were performed.
