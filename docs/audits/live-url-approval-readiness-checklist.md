# Live URL Approval Readiness Checklist

Date: 2026-06-20
Agent: approval-readiness-agent
Status: READY_FOR_NEXT_STAGE

## Scope

This checklist lists public URLs required for Google Workspace API approval and Chrome Web Store approval. Live URL status remains `UNKNOWN` until each URL is checked from the public internet.

No live status is claimed in this document. No production DB, Prisma schema, migration, or EdgeNode migration work was performed.

## Required Public Live URLs

| URL | Purpose | Repo route evidence found | Status |
| --- | --- | --- | --- |
| `https://www.craftmyfunnel.live/` | Homepage / app landing URL for Google consent and Chrome listing | `apps/web/src/app/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/privacy` | Privacy policy for Google and Chrome approval | `apps/web/src/app/privacy/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/terms` | Terms URL for Google consent and public trust footer | `apps/web/src/app/terms/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/security` | Security posture / integration safety support page | `apps/web/src/app/security/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/support` | Support URL for Google consent and Chrome Web Store | `apps/web/src/app/support/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/data-deletion` | Data deletion request page | `apps/web/src/app/data-deletion/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/google-api-disclosure` | Google API Limited Use disclosure | `apps/web/src/app/google-api-disclosure/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/contact` | Contact URL linked from footer trust area | `apps/web/src/app/contact/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/help` | Help Center URL linked from footer resources area | `apps/web/src/app/help/page.tsx` | UNKNOWN |
| `https://www.craftmyfunnel.live/faq` | FAQ URL linked from footer resources area | `apps/web/src/app/faq/page.tsx` | UNKNOWN |

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

The trust pages inspected for this workstream are implemented as Next.js routes under `apps/web/src/app`.

## Approval Readiness Checks To Run Later

- Open each public URL in a clean browser session with no logged-in app state.
- Confirm each URL returns HTTP 200.
- Confirm each page is not blocked by authentication.
- Confirm SSL certificate is valid for `www.craftmyfunnel.live`.
- Confirm pages do not depend on local DNS or preview-only deployment URLs.
- Confirm footer links work from the homepage.
- Confirm support email is visible and uses `support@craftmyfunnel.live`.
- Confirm privacy, data deletion, and Google API disclosure pages are accessible from the approval submission URLs.
- Confirm Chrome Web Store support and privacy URL fields use live public URLs.
- Confirm Google OAuth consent screen uses the same live public domain.

## Current Status Summary

All listed URL statuses are `UNKNOWN` because this pass did not perform live public URL checks. Repo route evidence was found for the approval support pages, including `terms`, `contact`, `help`, and `faq`.
