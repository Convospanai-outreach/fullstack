# Google, Clerk, Gmail & Redis Verification Checklist

Date: 2026-06-30
Latest Main SHA: `d53520bba68e1f5ea95d420237d667cc8a1891b4`
PR #57 Status: `BLOCKED_UNTIL_CI_GREEN` (lockfile resolved, awaiting CI verification)

---

## 1. DNS Foundation Status
The Cloudflare DNS records for Google Workspace are fully configured and verified:
* **MX Records**: Resolving to Google mail servers (PASS)
* **SPF Record**: TXT record present (PASS)
* **DKIM Record**: TXT record present (PASS)
* **DMARC Record**: TXT record present (PASS)
* **Google Site Verification**: TXT verification record present (PASS)

*Verdict: PASS_DNS_FOUNDATION*

---

## 2. Google Cloud OAuth Verification Checklist
The human operator must verify the following in the Google Cloud Console for the targeted project:
* [ ] **Correct Project Selected**: Ensure the production project (not sandbox/development) is active.
* [ ] **Gmail API**: Enabled (Required).
* [ ] **Google Calendar API**: Enabled (Required if calendar sync/features are used).
* [ ] **People API**: Enabled (Required if contact/profile data import is used).
* [ ] **Drive API**: Enabled ONLY if email attachments or file exports require direct Google Drive uploads. Otherwise, leave disabled.
* [ ] **OAuth Consent Screen Configuration**:
  * [ ] App Name & Logo: Verified matches "CraftMyFunnel".
  * [ ] Support Email: Configured to `support@craftmyfunnel.live`.
  * [ ] Developer Contact Email: Configured correctly.
  * [ ] Privacy Policy URL: Configured to `https://craftmyfunnel.live/privacy`.
  * [ ] Terms of Service URL: Configured to `https://craftmyfunnel.live/terms`.
  * [ ] Publishing Status: Moved to **In Production** (not Testing) to prevent token expiry after 7 days.
  * [ ] Authorized JavaScript Origins: Configured to `https://craftmyfunnel.live`.
  * [ ] Authorized Redirect URIs: Configured to `https://craftmyfunnel.live/api/proxy/integrations/google/oauth/callback`.

*Verdict: NEEDS_MANUAL_VERIFICATION*

---

## 3. Clerk Production Verification Checklist
The human operator must verify the following in the Clerk Dashboard:
* [ ] **Production Instance Active**: Switched from Development to Production mode.
* [ ] **Domain Configuration**:
  * [ ] Primary domain set to `craftmyfunnel.live`.
  * [ ] Apex and `www` redirects configured correctly.
* [ ] **Paths Configuration**:
  * [ ] Sign-in path configured to `/sign-in`.
  * [ ] Sign-up path configured to `/sign-up`.
* [ ] **Google Social Login**: Enabled and configured with custom Google credentials (using the production Google Cloud client ID and secret) if Clerk manages social auth.
* [ ] **Test User Account**:
  * [ ] Test user account created manually by a human.
  * [ ] **CRITICAL WARNING**: Do NOT share the test account credentials/passwords with Codex, Gemini, ChatGPT, or commit them to the repository.

*Verdict: NEEDS_EXECUTION*

---

## 4. Gmail Connection Integration Checklist
Perform this flow to verify correct token storage and mailbox sync:
* [ ] **Login**: Sign in using the manually created test user account.
* [ ] **Connect Mailbox**: Click "Connect Gmail" on the workspace/mailbox integration screen.
* [ ] **Google Consent**: Walk through the Google OAuth screen, accept permissions, and redirect back.
* [ ] **Mailbox Presence**: Verify that the connected Gmail address is visible in the mailbox list under `/setup?step=3` or `/intel`.
* [ ] **Refresh Token Persistence**:
  * [ ] Let the session idle, or manually trigger a synchronization command/page load after 1 hour.
  * [ ] Verify that no "Token Expired" or re-auth prompts appear, showing the refresh token is stored and encrypted correctly.
* [ ] **Controlled Send Test**:
  * [ ] Send exactly **one** test email to a controlled email address (owned by the test operator).
  * [ ] Do NOT send bulk or unsolicited emails.
  * [ ] Confirm receipt, headers, and metadata in the recipient inbox.
* [ ] **Disconnect**: Disconnect the mailbox. Verify it is removed from the UI.
* [ ] **Reconnect**: Re-authenticate and verify that the mailbox is re-linked cleanly.

*Verdict: NEEDS_EXECUTION*

---

## 5. Redis Execution Checklist
* [ ] **Env Verification**: Check Vercel/Railway environment variables to ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or direct Redis connection strings) are set.
* [ ] **Ping Check**: Run a safe ping/read-only test script to check latency and connectivity.
* [ ] **Isolation Check**:
  * [ ] Verify that Preview, Staging, and Production deployments use different Redis databases or prefix key namespaces (e.g. `web-prod:`, `web-preview:`, `api-prod:`).
  * [ ] Confirm that key deletion/cache flushes in Preview environments do not mutate or clear Production data.

*Verdict: NEEDS_EXECUTION*

---

## 6. Full Functional Smoke Test Checklist
Perform these steps sequentially to confirm overall app sanity:
* [ ] **Signup / Login**: Create a new account or sign in via Clerk.
* [ ] **Dashboard Load**: Open `/dashboard` and verify strict quality boundary metrics render.
* [ ] **Workspace / Team Resolution**: Verify that the workspace resolves correctly and routes match.
* [ ] **Connect Gmail**: Link a test Gmail account successfully.
* [ ] **Lead Import**: Create or import a single lead record manually.
* [ ] **Campaign Creation**: Create an email outreach campaign.
* [ ] **AI Generation**: Generate an email body sequence using AI writer/service.
* [ ] **Outreach Send**: Send a single test email through the campaign sequence to a controlled recipient.
* [ ] **Reply / Open Tracking**: Verify that reply or open tracking metrics are logged if that tracking flow is enabled.

---

## 7. Pass/Fail Criteria
* **PASS**: All manual checks completed successfully, Redis namespace isolation proven, Gmail OAuth connection resolves without scopes drift or authorization loop, test email lands in the target inbox, and all functional pages load without React crashes or runtime database exceptions.
* **FAIL**: Any authorization loop, missing environment variables, Redis data cross-contamination, database table/column errors during routing, or failure to persist refresh tokens.

---

## 8. Remaining Blockers
1. **PR #57 CI run**: Must pass and become green before merging.
2. **PR #6 (Gmail business mail control)**: Remains BLOCKED pending schema drift proof/decomposition.
3. **Supabase schema/migration proof execution**: Diagnostic checks passed locally; must be verified on main after merge.
4. **Clerk user/team linkage execution**: Pending manual login execution checks.
5. **Redis/cache isolation execution**: Pending namespace isolation proof.
6. **Stage 12A security gate**: Not started.
7. **Product readiness**: **NOT_READY**.
