# Live URL Approval Readiness Checklist

Date: 2026-06-20
Agent: approval-readiness-agent
Status: IN_PROGRESS

## Scope

This checklist lists public URLs required for Google Workspace API approval and Chrome Web Store approval. Live URL status is marked only after an actual public HTTPS check.

No production DB, Prisma schema, migration, or EdgeNode migration work was performed.

## Verification Method

- Vercel deployment for commit `6d012ea382ec324cdb73bcdcff9c5d00a843d795` was checked first and is `READY`.
- Local DNS/hosts maps `craftmyfunnel.live` and `www.craftmyfunnel.live` to `127.0.0.1`, so normal local HTTPS requests cannot reach the public site.
- Public DNS-over-HTTPS resolved `www.craftmyfunnel.live` through Vercel DNS to public A records `216.198.79.65` and `64.29.17.65`.
- The live HTTPS checks connected to Vercel public IP `216.198.79.65` with SNI `www.craftmyfunnel.live`, preserving TLS certificate verification while bypassing the local hosts override.
- External web fetches were also used to confirm rendered content and redirects.

## Required Public Live URLs

| URL | Purpose | Repo route evidence found | HTTP status / redirect | Public without login | SSL works | Approval content | Support email/domain | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `https://www.craftmyfunnel.live/` | Homepage / app landing URL for Google consent and Chrome listing | `apps/web/src/app/page.tsx` | `200` | Yes | Yes | Yes: homepage includes governed funnel workflow, Google Workspace/Gmail connection copy, footer legal/trust links | `support@craftmyfunnel.live` present | LIVE_PUBLIC_200 |
| `https://www.craftmyfunnel.live/privacy` | Privacy policy for Google and Chrome approval | `apps/web/src/app/privacy/page.tsx` | `200` | Yes | Yes | Yes: Privacy Policy, Google user data, retention/deletion, no advertising use | `support@craftmyfunnel.live` present | LIVE_PUBLIC_200 |
| `https://www.craftmyfunnel.live/terms` | Terms URL for Google consent and public trust footer | `apps/web/src/app/terms/page.tsx` | `200` | Yes | Yes | Yes: Terms & Conditions, third-party integrations, outreach/channel usage, data and privacy | Mismatch: page contact is `bizcomm.soulutions@gmail.com`, not `support@craftmyfunnel.live` | LIVE_PUBLIC_200_WITH_DOMAIN_MISMATCH |
| `https://www.craftmyfunnel.live/security` | Security posture / integration safety support page | `apps/web/src/app/security/page.tsx` | Initial `307` to `/login?callbackUrl=%2Fsecurity`; final login page `200` | No | Yes | No: login page instead of security page | Login page includes footer/support signals, but security content is inaccessible | NEEDS_REPLAN_LOGIN_REDIRECT |
| `https://www.craftmyfunnel.live/support` | Support URL for Google consent and Chrome Web Store | `apps/web/src/app/support/page.tsx` | Initial `307` to `/login?callbackUrl=%2Fsupport`; final login page `200` | No | Yes | No: login page instead of support page | Login page includes footer/support signals, but support content is inaccessible | NEEDS_REPLAN_LOGIN_REDIRECT |
| `https://www.craftmyfunnel.live/data-deletion` | Data deletion request page | `apps/web/src/app/data-deletion/page.tsx` | Initial `307` to `/login?callbackUrl=%2Fdata-deletion`; final login page `200` | No | Yes | No: login page instead of data deletion page | Login page includes footer/support signals, but deletion content is inaccessible | NEEDS_REPLAN_LOGIN_REDIRECT |
| `https://www.craftmyfunnel.live/google-api-disclosure` | Google API Limited Use disclosure | `apps/web/src/app/google-api-disclosure/page.tsx` | Initial `307` to `/login?callbackUrl=%2Fgoogle-api-disclosure`; final login page `200` | No | Yes | No: login page instead of Google API disclosure page | Login page includes footer/support signals, but disclosure content is inaccessible | NEEDS_REPLAN_LOGIN_REDIRECT |
| `https://www.craftmyfunnel.live/contact` | Contact URL linked from footer trust area | `apps/web/src/app/contact/page.tsx` | `200` | Yes | Yes | Yes: contact form and channels | Mismatch: page uses `support@craftmyfunnel.com` and `enterprise@craftmyfunnel.com`, not `support@craftmyfunnel.live` | LIVE_PUBLIC_200_WITH_DOMAIN_MISMATCH |
| `https://www.craftmyfunnel.live/help` | Help Center URL linked from footer resources area | `apps/web/src/app/help/page.tsx` | `200` | Yes | Yes | Yes: Help Center, setup, billing, imports, support path | `support@craftmyfunnel.live` present in footer | LIVE_PUBLIC_200 |
| `https://www.craftmyfunnel.live/faq` | FAQ URL linked from footer resources area | `apps/web/src/app/faq/page.tsx` | `200` | Yes | Yes | Yes: FAQ content and footer trust links | `support@craftmyfunnel.live` present in footer | LIVE_PUBLIC_200 |

## Failing Approval URLs

These routes are not currently public approval pages because they redirect unauthenticated users to login:

- `https://www.craftmyfunnel.live/security`
- `https://www.craftmyfunnel.live/support`
- `https://www.craftmyfunnel.live/data-deletion`
- `https://www.craftmyfunnel.live/google-api-disclosure`

These routes are public, but have support email/domain mismatches that should be corrected before approval submission:

- `https://www.craftmyfunnel.live/terms`
- `https://www.craftmyfunnel.live/contact`

## Footer Route Evidence

`apps/web/src/components/Footer.tsx` links to:

- `/help`
- `/faq`
- `/support`
- `/terms`
- `/privacy`
- `/data-deletion`
- `/security`
- `/google-api-disclosure`
- `/contact`

The trust pages inspected for this workstream are implemented as Next.js routes under `apps/web/src/app`, but some are currently gated by live middleware/auth behavior.

## Required Replan

Before Google Workspace API or Chrome Web Store submission:

- Make `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` publicly accessible without login. Implemented in `apps/web/src/proxy.ts`; awaiting deploy and live recheck.
- Align public support/contact email domains to `support@craftmyfunnel.live`, especially on `/terms` and `/contact`. Implemented in `apps/web/src/app/terms/page.tsx` and `apps/web/src/app/contact/page.tsx`; awaiting deploy and live recheck.
- Re-run this live URL checklist from the public internet after the route/auth and email-domain fixes are deployed.
- Keep DB Phase 5 blocked separately; no DB migration work is required for this approval URL fix.

## Current Status Summary

Overall status is `IN_PROGRESS`. The route allowlist and email-domain fixes have been implemented locally, but live URL status remains based on the last public check until Vercel deploys this commit and the required URLs are rechecked.
