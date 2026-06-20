# Google Workspace API Approval Plan

Date: 2026-06-20
Agent: approval-readiness-agent
Status: READY_FOR_NEXT_STAGE

## Scope

This is a documentation-only readiness plan for Google Workspace / Gmail API approval. No code changes, Prisma schema changes, migrations, production database operations, or Google Cloud changes were made.

DB Phase 5 remains `BLOCKED_EXTERNAL_ACCESS` because live Supabase `DATABASE_URL` / `DIRECT_URL` verification is not available.

## Repo Evidence Inspected

- Gmail OAuth and mailbox service: `apps/api/src/modules/email-campaigner/service/googleMailboxService.ts`
- OAuth start route: `apps/api/routes/integrations/google/oauth/start/route.ts`
- OAuth callback route: `apps/api/routes/integrations/google/oauth/callback/route.ts`
- Public trust pages:
  - `apps/web/src/app/privacy/page.tsx`
  - `apps/web/src/app/security/page.tsx`
  - `apps/web/src/app/support/page.tsx`
  - `apps/web/src/app/data-deletion/page.tsx`
  - `apps/web/src/app/google-api-disclosure/page.tsx`
- Footer trust/legal links: `apps/web/src/components/Footer.tsx`

## Current Gmail OAuth Scopes Found In Code

`GOOGLE_MAIL_SCOPES` currently includes:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`

Approval risk: `gmail.readonly` is a restricted Gmail scope and increases the Google verification and security-assessment burden. If the first approval target is send-only mailbox connection, split approval into G1 and G2.

## Required Environment Variables Found In Code

The code path requires:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_GMAIL_REDIRECT_URI`
- `ENCRYPTION_KEY`
- `NEXTAUTH_SECRET` or `AUTH_SECRET`
- `WEB_BASE_URL` or `NEXTAUTH_URL`

Notes:

- `GOOGLE_GMAIL_REDIRECT_URI` is the required redirect env in the thrown configuration error. The service also checks `GOOGLE_OAUTH_REDIRECT_URI` as a fallback, but approval docs and deployment config should use `GOOGLE_GMAIL_REDIRECT_URI`.
- `ENCRYPTION_KEY` must be at least 32 characters and is used for token encryption.
- `NEXTAUTH_SECRET`, `AUTH_SECRET`, or `ENCRYPTION_KEY` is used for OAuth state signing. Approval/runtime configuration should prefer `NEXTAUTH_SECRET` or `AUTH_SECRET` rather than relying on the encryption key fallback.

## Exact OAuth Endpoints

OAuth start endpoint:

```text
/api/proxy/integrations/google/oauth/start?next=/setup?step=3
```

OAuth callback route:

```text
/api/proxy/integrations/google/oauth/callback
```

The API route mounted behind the proxy is:

```text
/integrations/google/oauth/callback
```

The Google Cloud Console redirect URI should use the public callback URL on the verified app domain, for example:

```text
https://www.craftmyfunnel.live/api/proxy/integrations/google/oauth/callback
```

## Recommended Approval Split

Use a two-step Google approval path:

- G1 send-only approval: request `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/gmail.send`.
- G2 reply/bounce sync later: add `https://www.googleapis.com/auth/gmail.readonly` only after send-only approval and after reply/bounce sync is ready to demonstrate.

Reason: `gmail.readonly` materially increases restricted-scope review burden, may require deeper Limited Use evidence, and can trigger a security assessment depending on app classification and data handling.

## Google Cloud Console Checklist

- Create or confirm the production Google Cloud project for CraftMyFunnel.
- Confirm the OAuth client type is Web application.
- Set the authorized JavaScript origins:
  - `https://www.craftmyfunnel.live`
- Set the authorized redirect URI:
  - `https://www.craftmyfunnel.live/api/proxy/integrations/google/oauth/callback`
- Confirm the OAuth client id and secret are deployed as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- Confirm `GOOGLE_GMAIL_REDIRECT_URI` exactly matches the authorized redirect URI.
- Confirm production secrets are not exposed in frontend code, screenshots, logs, docs, or support artifacts.
- Confirm app domain and support email match the OAuth consent screen.
- Confirm APIs enabled:
  - Gmail API
  - Google People/OpenID scopes do not require a separate Gmail API enablement, but the app still needs OAuth consent configuration.
- Confirm test users are configured if the app remains in testing mode.
- Confirm publishing status, user type, and app verification status before inviting real Workspace users.

## OAuth Consent Screen Checklist

- App name: CraftMyFunnel.
- User support email: `support@craftmyfunnel.live`.
- App logo uploaded if required.
- App domain:
  - `craftmyfunnel.live`
- Authorized domain:
  - `craftmyfunnel.live`
- Developer contact email configured.
- Homepage URL:
  - `https://www.craftmyfunnel.live/`
- Privacy Policy URL:
  - `https://www.craftmyfunnel.live/privacy`
- Terms URL:
  - `https://www.craftmyfunnel.live/terms`
- Security / disclosure URLs included where Google asks for supporting evidence:
  - `https://www.craftmyfunnel.live/security`
  - `https://www.craftmyfunnel.live/google-api-disclosure`
  - `https://www.craftmyfunnel.live/data-deletion`
- Scope descriptions are least-privilege and user-facing:
  - Gmail send: send user-approved emails from a connected mailbox.
  - Gmail readonly, if included later: read message metadata/content only to detect replies and bounces for user-owned outreach workflows.
- Demo video shows the exact consent, connection, send-only usage, disconnect/deletion path, and no unrelated mailbox browsing.

## Domain Verification Checklist For craftmyfunnel.live

- Verify `craftmyfunnel.live` in Google Search Console or Google Cloud domain verification.
- Confirm `www.craftmyfunnel.live` resolves publicly to the production app.
- Confirm the OAuth consent screen authorized domain is `craftmyfunnel.live`.
- Confirm the public trust pages are accessible without login.
- Confirm DNS and SSL are stable before submitting verification.
- Confirm support email domain alignment:
  - `support@craftmyfunnel.live`
- Confirm no local DNS override or preview-only URL is used in the approval submission.

## Public URL Checklist

These URLs should be publicly reachable before submission:

- `/`
- `/privacy`
- `/terms`
- `/security`
- `/support`
- `/data-deletion`
- `/google-api-disclosure`

Repo route evidence exists for the listed trust pages. Live status is not claimed in this document.

## Demo Video Script For Google OAuth Verification

1. Start on `https://www.craftmyfunnel.live/`.
2. Sign in as a test user with access to a test workspace.
3. Navigate to the setup or integrations flow.
4. Click the Google mailbox connect action that calls:
   - `/api/proxy/integrations/google/oauth/start?next=/setup?step=3`
5. Show the Google consent screen.
6. Point out the scopes being requested.
7. Approve with a test Gmail or Google Workspace mailbox.
8. Return through:
   - `/api/proxy/integrations/google/oauth/callback`
9. Show the mailbox connected state in CraftMyFunnel.
10. For G1 send-only, send or prepare a user-approved test email from the connected mailbox.
11. Show that the app does not expose inbox browsing or unrelated mailbox data.
12. Show where the user can disconnect the mailbox or request deletion.
13. Open the public pages:
   - Privacy
   - Security
   - Data deletion
   - Google API disclosure
   - Support
14. End by explaining that Google user data is used only for user-requested product functionality and not for advertising.

## Submission Recommendation

Submit G1 first with `gmail.send` only. Defer `gmail.readonly` until G2 when reply/bounce sync can be demonstrated with narrow data use, retention, deletion, and Limited Use evidence.

No code changes should be made as part of this approval plan unless a separate implementation task is explicitly opened.
