# Public Approval Pages Fix

Date: 2026-06-20
Agent: approval-readiness-agent
Status: IN_PROGRESS

## Scope

This implementation pass fixes approval-critical public page access and public support email alignment for Google Workspace OAuth verification and Chrome Web Store review.

No production DB, Prisma schema, migration, EdgeNode migration, DB Phase 5, or PR #6 work was performed.

## Files Changed

- `apps/web/src/proxy.ts`
- `apps/web/src/app/terms/page.tsx`
- `apps/web/src/app/contact/page.tsx`
- `docs/audits/public-approval-pages-fix.md`
- `docs/audits/live-url-approval-readiness-checklist.md`
- `docs/codex/WORKFLOW_STATE.md`
- `docs/codex/VERIFICATION_MATRIX.md`

## Routes Made Public

The following routes were added to the unauthenticated public path allowlist in `apps/web/src/proxy.ts`:

- `/security`
- `/support`
- `/data-deletion`
- `/google-api-disclosure`

## Emails Standardized

Public support/contact email references were standardized to:

```text
support@craftmyfunnel.live
```

Changes:

- `/terms`: replaced `bizcomm.soulutions@gmail.com`.
- `/contact`: replaced `support@craftmyfunnel.com`.
- `/contact`: replaced `enterprise@craftmyfunnel.com` with `support@craftmyfunnel.live` because no verified `enterprise@craftmyfunnel.live` mailbox was available.

## Required Post-Deploy Live URL Recheck

After Vercel deploys this commit and reaches `READY`, re-run public HTTPS checks for:

- `https://www.craftmyfunnel.live/security`
- `https://www.craftmyfunnel.live/support`
- `https://www.craftmyfunnel.live/data-deletion`
- `https://www.craftmyfunnel.live/google-api-disclosure`
- `https://www.craftmyfunnel.live/terms`
- `https://www.craftmyfunnel.live/contact`

Do not mark approval readiness `READY_FOR_NEXT_STAGE` until the live recheck confirms all required URLs are public without login and support email/domain mismatches are resolved.

## Validation

- Inspected `apps/web/src/proxy.ts` route protection logic and matcher.
- Inspected changed public page files:
  - `apps/web/src/app/terms/page.tsx`
  - `apps/web/src/app/contact/page.tsx`
- `npm run lint --workspace apps/web`: timed out after 120s before completing.
- `npm run typecheck --workspace apps/web`: timed out after 180s before completing.
- `npm run build --workspace apps/web`: timed out after 240s before completing.
- `npx eslint src/proxy.ts src/app/contact/page.tsx src/app/terms/page.tsx` from `apps/web`: passed.
