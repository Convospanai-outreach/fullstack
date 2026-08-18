# Frontend Audit — craftmyfunnel.live

Live production site audited end-to-end via Playwright browser automation, logged in as
`tewari.85@gmail.com` (Clerk). Date: 2026-08-18.

**Audit run in 4 parallel groups.** All four hit the session's API rate limit mid-run and were cut
short before finishing their full route lists. What each group did complete is written up below.
**This audit is NOT fully complete** — see "Coverage gaps" at the end for the exact list of routes
that were never reached. Re-run those before treating this as a full sign-off.

## Fix status (2026-08-18, code-only — not yet deployed/re-verified live)

| # | Finding | Status |
|---|---|---|
| — | CSP `connect-src` blocks `NEXT_PUBLIC_API_URL` origin (systemic, ~30 pages) | **Fixed** — `src/proxy.ts` now allowlists the API origin dynamically |
| — | Vestigial NextAuth causing sitewide 429s | **Fixed the actual trigger** — `/api/auth/session` and `/api/auth/clerk-sync` moved off the 5-req/hr `AUTH` bucket onto a new `SESSION_CHECK` bucket (`src/lib/rateLimit.edge.ts`, `src/proxy.ts`). Did **not** rip out NextAuth itself — it's still actively used for admin RBAC (`lib/admin.ts`, admin API routes) and `useSession()` in `caller`, `client`, `BillingPage` — removing it is a much larger change than the audit implied and needs its own scoping pass |
| B1/B2 | `/leads/new`, `/pipeline` broken by CSP | **Fixed** (covered by CSP fix) — not independently re-verified live |
| B3 | `/leads/[id]` always "Lead not found" (async-params bug) | **Fixed** — `use(params)` |
| B5 | `/calendar` meetings never load, no error state | **Fixed** by CSP fix; not independently re-verified live |
| C4 | `/analytics/ai` all-zero KPIs | **Fixed** (covered by CSP fix) — not independently re-verified live |
| D1 | `/admin/ai-config` — backend endpoint missing | **Fixed — original diagnosis was wrong.** The backend (`apps/api/routes/admin/ai-config/route.ts`) already fully existed (per-team AI provider config, masked keys, audit logging). The real bug: `apps/web`'s proxy (`src/app/api/proxy/[...path]/route.ts`) treated the *entire* `admin` root as web-owned, so any admin sub-path apps/web doesn't implement itself (`ai-config`, `audit`, `health`, `observability`, `rate-limits`, `usage`, `client-errors`, `super`) got redirected to a nonexistent apps/web route and 404'd instead of proxying to apps/api. Fixed by giving `admin` the same path-level matching `settings`/`email`/`leads` already had (only `cms`/`invites`/`users` are actually web-owned) |
| D17 | `/governance/guardrails` stuck on "Loading Policy..." forever | **Fixed** — added `.catch()` and an error state |
| D2–D25 | Remaining CSP-blocked admin/governance/settings pages | **Fixed** (covered by CSP fix) — not independently re-verified live |
| A2 | `/contact` form hard-fails (503) | **Fixed** — now degrades gracefully like `/api/support/contact` |
| A1 | `/about`, `/pricing`, `/contact`, `/privacy`, `/terms` missing header/footer | **Fixed** — removed from `LayoutShell`'s marketing-prefix list so they fall through to the generic `Header`/`Footer` |
| A4 | `/p/[slug]` returns 500 instead of 404 for unknown slug | **Investigated, not reproducible in source** — `apps/api`'s `getPublicPage` handler (`src/modules/landing-agent/api/handlers.ts`) already returns a clean 404 when `getPublicPageBySlug` finds nothing (simple Prisma `findFirst`, no throw). The 500 the audit saw likely came from the proxy layer or an infra/deployment issue, not this code path — re-test after the other fixes deploy before investigating further |
| A5 | Missing page `<title>` metadata | **Fixed** — added `metadata` exports (directly or via a sibling `layout.tsx` for client components) to `/faq`, `/security`, `/data-deletion`, `/google-api-disclosure`, `/support`, `/contact`, `/help`, `/docs/api`, `/verify-email` |
| A6 | Orphaned `(marketing)/privacy/layout.tsx`, `(marketing)/terms/layout.tsx` | **Not fixed, flagged only** — per repo convention, not deleting unrelated dead code without being asked |
| C2 | `/profile` hardcoded fake user + missing chrome | **Fixed** — moved into `(dashboard)` route group, wired to real Clerk user via `useUser()` |
| D28 | `/governance` dead "View Audit Log" button | **Fixed** — now a real `Link` to `/governance/audit` |
| D26/D27 | `/admin/invites`, `/admin/users` — 403 masked as empty state | **Fixed** — both now show a distinct permission-denied message instead of a misleading "no data" row |
| C3 | `/analytics/roi` dead buttons | **Fixed.** "Export Report" now downloads a real CSV of the loaded data. "Last 6 Months" was a static label with no actual alternate range — `apps/api/routes/analytics/roi/route.ts` had the 6-month window hardcoded. Added a `?months=` param (1–24, default 6) to the backend and replaced the dead button with a working 3/6/12-month toggle that refetches |
| — | Same proxy whole-root-misclassification bug found in 3 more places while fixing D1 | **Fixed.** `dashboard` (apps/web only has `dashboard/{funnel,summary}`; `activities`/`analytics`/`briefing`/`campaigns`/`stats` are apps/api-only — `DashboardPage.tsx`'s `/dashboard/stats` call is currently masked by the CSP fix since `NEXT_PUBLIC_API_URL` is absolute in prod, but this proxy bug would silently reappear the moment that env var is ever corrected to the architecturally-intended relative `/api/proxy`, per `DEPLOYMENT_RUNBOOK.md`; `src/components/dashboard/useDashboard.ts`'s `dashboard/campaigns`/`dashboard/activities`/`dashboard/analytics` hooks hit the same bug unconditionally, though they currently have no callers anywhere in the app) and `upload`/`integrations` (apps/web is missing `upload/pdf` and `integrations/google/{domain-checks,mailboxes/sync,pubsub}`, used by `/setup` and the landing-agent PDF upload flow — these are NOT shielded by the CSP fix since they always call the same-origin proxy directly) had the identical bug. All now use path-level matching in `src/app/api/proxy/[...path]/route.ts` |
| B6 | `/inbox` → `/approvals` redirect naming | **Not fixed** — intentional behavior, cosmetic naming concern only, not a code bug |
| B4 | `/crm` "under active development" stub | **Not fixed** — already self-labeled correctly, no action needed |
| B7 | `/funnel` scope mismatch (public page, not an authed CRM feature) | **Not fixed** — product question (was an authenticated funnel-builder ever meant to exist here?), not a code bug |

**Everything above is a code change only — nothing has been deployed or re-verified against the live
site yet.** Re-run (at least) the previously-broken routes after deploy, and finish the untested routes
listed in "Coverage gaps" below.

## Ultrareview follow-ups (found in review of the fix commit itself)

| Finding | Status |
|---|---|
| A1 fix was incomplete: `/security` is still in `LayoutShell`'s `DASHBOARD_PREFIXES` (a separate list from the `MARKETING_PREFIXES` fixed earlier), so it still rendered with no chrome | **Fixed** — removed from `DASHBOARD_PREFIXES` |
| `apps/api`'s new `/analytics/roi?months=` handling: `Number(null)` is `0`, which is finite, so the intended `: 6` default was unreachable dead code — any caller that omits `months` (e.g. `ROIService.getSummary()`, feeding the executive dashboard's ROI chart) silently got a 1-month window instead of 6 | **Fixed** — branch on the raw query string before coercing to `Number` |
| ROI months toggle had no fetch cancellation — rapid clicking between 3/6/12mo could let a stale response overwrite a newer one, desyncing the highlighted button from the displayed data | **Fixed** — added `AbortController`, aborted in the effect cleanup |
| "Export Report" only exported the history table, silently dropping the funnel/financials/campaigns data also shown on the page, despite the button's name implying the whole report | **Fixed** — export now includes all four sections (funnel & financials, top campaigns, and history) in one CSV |
| `UserManagementPage`'s new in-`<tbody>` loading row was unreachable — dead code — because a pre-existing early `return` above it already short-circuited the whole component while `loading` was true | **Fixed** — removed the early return so the loading/error states render inside the full page shell, matching the `InvitesPage` sibling pattern |

## PR bot review follow-ups (Hacktron, CodeAnt, Greptile — on the PR itself)

| Finding | Status |
|---|---|
| **CSV formula injection** in the ROI export (flagged independently by all 3 bots, with Greptile providing an executed PoC): a campaign name starting with `=`, `+`, `-`, or `@` is quoted but not neutralized, so opening the exported CSV in Excel/Sheets can execute it as a formula | **Fixed** — cells starting with a formula-trigger character are now prefixed with `'` before quoting, the standard mitigation |
| `/leads/[id]` has the identical race-condition pattern already found on `/analytics/roi`: no fetch cancellation on `id` change, so a slow response for a previous lead can overwrite the current one | **Fixed** — added `AbortController` + reset `lead`/`loading` state on `id` change |
| **`DASHBOARD_PREFIXES` had far more instances of the `/security` bug than the one ultrareview caught**: `/setup`, `/scraper-bridge`, `/onboarding`, `/audit-logs`, `/automations`(`/approvals`), `/calendar`, `/jobs`(`/[id]`), `/monitoring`, `/notifications`, `/admin/client-errors`, `/admin/cms`(`/edit`), `/admin/content`, and `/dashboard/settings/compliance` were all top-level pages (not inside the `(dashboard)` route group) incorrectly classified as dashboard routes — so they rendered with **no chrome at all** (no sidebar, no generic header/footer). A full cross-check of every `DASHBOARD_PREFIXES` entry against the actual route tree was run to make sure none were missed this time | **Fixed** — moved `audit-logs`, `automations`, `calendar`, `jobs`, `monitoring`, `notifications`, `admin/client-errors`, `admin/cms`(`/edit`), `admin/content`, and `dashboard/settings/compliance` into the `(dashboard)` route group so they get the real sidebar (same pattern as the earlier `/profile` fix — all used absolute `@/` imports, so no import-path changes were needed). `/setup`, `/scraper-bridge`, `/onboarding` were left top-level and removed from `DASHBOARD_PREFIXES` instead, since a setup wizard / redirect-only page arguably shouldn't show the full authenticated-app nav |
| ROI API: the `?months=` window only ever scoped `history` — `funnel`, `financials`, and `campaigns` still aggregate the team's entire lifetime, so the KPI tiles and the trend chart silently cover different periods | **Addressed via clarification, not full re-scoping** — properly date-scoping funnel/financials/campaigns would need additional schema queries (e.g. campaign send timestamps aren't currently fetched) and is really a separate feature, not a wiring fix. Instead: the toggle now has a tooltip and the chart card title/description explicitly say what it controls, the KPI grid is labeled "Lifetime totals," and the CSV export sections are labeled accordingly, so the two periods are no longer silently conflated |
| `/api/contact`'s SMTP-down fallback claims `status: "queued"` / success but the payload is only `console.info`-logged, not persisted anywhere — an unrecoverable false-success. **Investigating this surfaced that `/contact/page.tsx` actually posts to `/api/support/contact`, not `/api/contact` at all** — `/api/contact` has zero live callers anywhere in the app, so the original audit's A2 finding was effectively describing a dead code path, and my earlier "fix" (copying the queued-success pattern from `/api/support/contact`) fixed an endpoint nothing calls | **Fixed by reverting to an honest failure response** — no durable queue backs this endpoint, so it now returns a `503` instead of a false-success `200`, rather than building new persistence infrastructure for an endpoint with no current caller |

## Follow-up pattern sweep (checking every other page for the same bug classes already found)

Since two bug classes recurred repeatedly across the fixes above (the Next.js 15 async-`params` bug,
and missing fetch cancellation on an id/filter change), every other dynamic `[id]`/`[slug]` route was
checked for the same patterns rather than waiting for another audit or bot pass to find them one at a time.

| Finding | Status |
|---|---|
| `/jobs/[id]` had the exact same async-`params` bug as the original `/leads/[id]` finding (`params: { id: string }` read synchronously off what's actually a `Promise` in this Next.js version) — job detail view always called `getJob(undefined)` and never loaded any job | **Fixed** — `use(params)`, same pattern as `/leads/[id]` and `/campaigns/[id]` |
| `/workflows/[id]` had the same missing-fetch-cancellation pattern as `/leads/[id]` and the ROI months toggle | **Fixed** — added `AbortController` + reset `workflow`/`loading` state on `id` change |
| Checked `/campaigns/[id]/edit`, `/landing-agent/[id]/{brief,editor,wireframes}`, `/p/[slug]`, `/p/[slug]/thank-you` for the same two patterns | **Clean** — all already use `use(params)` or the client-side `useParams()` hook correctly (the latter reads synchronously from the router and isn't affected by the async-params-as-Promise change at all) |

## Half-done features completed

Beyond fixing broken behavior, a pass was made looking for features that were fully wired up
server-side (or partially built client-side) but never actually reachable/usable — stub UI, dead
imports, "coming soon" placeholders sitting on top of working backends.

| Finding | Status |
|---|---|
| `WelcomeTour` — a fully-built onboarding tour component existed at `src/components/onboarding/WelcomeTour.tsx` but was never imported/rendered anywhere in the app, so no user could ever see it | **Fixed** — mounted in `(dashboard)/layout.tsx` alongside `Omnibox`. Also fixed a stale comment that inaccurately described its localStorage-gating as hardcoded-always-show, and fixed a tour step targeting `a[href='/agents']`, a nav link that no longer exists in `DashboardSidebar` — repointed to `a[href='/leads']`, which does |
| Campaign sequence builder's step picker had a static "Conditions are coming soon" message in the Conditions tab, and clicking any step in the sequence canvas had no way to configure it (no delay, no subject/body, no condition rules) — despite the backend (`apps/api`'s `sequenceService.ts`) already fully implementing condition evaluation (`leadStatusIn/NotIn`, `pipelineStateIn/NotIn`, `hasEmail`) with nothing in the UI to set it | **Fixed (user-approved: "Build the full step editor").** Added `StepEditorDialog.tsx` — a config panel opened by a new pencil/edit button on each step node (and auto-opened when a step is first added): delay (days/hours) for all step types, subject+body for Email, message body for LinkedIn steps with one, and a full condition builder (tag inputs for lead-status include/exclude, pipeline-stage chip toggles sourced from the canonical `PIPELINE_STAGES`, and a has-email tri-state select) for the Conditions tab. Each step node now shows a one-line summary of its configured state. `StepPicker.tsx`'s Conditions tab now lists the real "Lead condition" step type instead of the static placeholder. Verified by tracing the round-trip in source rather than live browser (see note below): `SequenceTab.tsx` maps `subject`/`body`/`delayDays`/`delayHours` on both the load-hydrate and save paths, `apps/api`'s `normalize()` lowercases `stepType` before comparison so `CONDITION` correctly matches the backend's `"condition"` check, and `conditionPasses()`'s `?.length &&` guards mean an emptied tag list is correctly treated as "no filter" rather than "match nothing." **Not independently re-verified live** — the local dev server runs Clerk in keyless/temporary-key mode (a separate auth instance from production) and the app's invite-only signup gate blocked creating a fresh local test account, so this couldn't be click-tested in a browser this session; re-test in the browser after deploy |

## Still open (deferred, not yet started)

| Item | Status |
|---|---|
| `settings/branding/page.tsx`'s logo field: "Upload feature coming soon. Use a public URL for now." | **Approved (Vercel Blob), not started** — needs the `marketplace` skill loaded first per repo convention before any provisioning |
| `DashboardSidebar.tsx` line ~158: `{/* TODO: org switcher — open org selection modal */}` | **Not triaged** — found during the stub-marker search, not yet raised with the user |

---

## TL;DR — one root cause explains most of the "BROKEN" findings below

**Content-Security-Policy blocks the browser from calling `https://api.craftmyfunnel.live` directly**,
and a large number of client components are built to call that host directly instead of going through
the app's own same-origin `/api/proxy/...` route.

- Client code pattern: `const API_BASE = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy"` — in
  production `NEXT_PUBLIC_API_URL` is set to the cross-origin `https://api.craftmyfunnel.live`.
- CSP `connect-src` (set in `apps/web/src/proxy.ts`, ~line 336) only allowlists:
  `'self' https://clerk.craftmyfunnel.live https://*.clerk.accounts.dev https://api.clerk.com https://api.razorpay.com https://*.google-analytics.com wss://*`
  — `api.craftmyfunnel.live` is **not** on the list.
- Result: every one of these fetches is blocked by the browser itself before it reaches the network
  (`Refused to connect because it violates the document's Content Security Policy`), the page's catch
  block swallows it, and the page silently shows an empty/zero/loading state forever.

**Fix is one of two things:** (a) point `NEXT_PUBLIC_API_URL` at the same-origin `/api/proxy` path in
production (like the code's own fallback already does when the env var is unset), or (b) add
`https://api.craftmyfunnel.live` to `connect-src` in `apps/web/src/proxy.ts`. Option (a) is preferable
since same-origin proxying is already the pattern used successfully elsewhere (e.g. `/approvals`,
`/settings/branding`).

Confirmed blocked live on (non-exhaustive — this is what was actually reproduced in-browser this run):
`/leads/new` (lead creation), `/leads/[id]` (also has a second, independent bug — see below), `/pipeline`,
`/calendar`, `/crm`, `/analytics/ai`, `/automations`, `/automations/approvals`, `/templates`, `/credits`
(also breaks Razorpay checkout script), `/notifications`, `/monitoring`, `/setup`, `/admin/audit`,
`/admin/health`, `/admin/observability`, `/admin/rate-limits`, `/admin/usage`, `/admin/client-errors`,
`/governance/access`, `/governance/audit`, `/governance/guardrails`, `/governance/keys`, `/settings/agent`,
`/settings/approvals`, `/settings/audit`, `/settings/budgeting`, `/settings/webhooks`, and (source-confirmed,
same code pattern, not all live-reproduced) `/workflows`, `/workflows/[id]`, `/playbooks`, `/marketplace`,
`/knowledge`, `/icp-builder`, `/team`, `/settings/governance`, `/settings/governance/analytics`,
`/settings/guardrails`, `/settings/hitl`, `/settings/notifications`, `/settings/sso`, `/settings/team`,
`/test-error-logging`.

**This is a Blocker.** It silently disables data loading (and any write action) on roughly a third to
half of the entire authenticated app surface, in production, right now.

### Second systemic issue: vestigial NextAuth SessionProvider fires alongside Clerk, causes 429 lockouts
The app's real auth is Clerk, but `apps/web/src/app/providers.tsx` still globally mounts a NextAuth
`SessionProvider` (`next-auth/react`) for every route not in a small `sessionFreePrefixes` allowlist.
It polls `GET /api/auth/session` on its own schedule. This was observed returning **429 Too many
requests** (with retry windows of ~50–60 minutes) on nearly every route audited, alongside
`[next-auth][error][CLIENT_FETCH_ERROR]` console spam, and in Group B's testing the same rate limiter
also throttled `/api/auth/clerk-sync` — the endpoint the *real* Clerk auth gate depends on
(`(dashboard)/layout.tsx`). Doesn't visibly break the UI today (Clerk cookies still gate the dashboard),
but it's dead code creating console noise and real risk of tripping the actual auth gate's rate limit
under normal multi-tab usage.
- **Files**: `apps/web/src/app/providers.tsx`, `apps/web/src/components/providers/SessionProvider.tsx`,
  `apps/web/src/app/api/auth/[...nextauth]/route.ts`, `apps/web/src/lib/auth.ts`
- **Classification**: BROKEN (dead/duplicate auth code path) — **Severity: major**

---

## Group A — Public / Marketing / Auth routes (complete)

Scope: `/`, `/about`, `/pricing`, `/contact`, `/faq`, `/privacy`, `/terms`, `/security`,
`/data-deletion`, `/google-api-disclosure`, `/docs/api`, `/help`, `/support`, `/login`, `/signup`,
`/forgot-password`, `/magic-link`, `/verify-email`, `/accept-invite`, `/agent-login`, `/client-login`,
`/login/sso`, `/p/[slug]`, `/p/[slug]/thank-you`

### A1. Marketing pages missing site header/footer navigation — BROKEN, Major
Pages: `/about`, `/pricing`, `/contact`, `/privacy`, `/security`, `/terms`. None render the site
`NavBar`/`Footer` — a visitor has no logo, no nav, no way back to the homepage, no footer links.
`(marketing)/layout.tsx` only wraps routes physically inside the `(marketing)/` route group; these six
pages are top-level siblings and aren't wrapped by any layout that adds chrome. `pricing/layout.tsx`
exists but only sets metadata. By contrast `/faq`, `/help`, `/support`, `/data-deletion`,
`/google-api-disclosure`, `/docs/api` import `NavBar`/`Footer` directly in-page and are fine.
- Files: `src/app/(marketing)/layout.tsx`, `src/app/about/page.tsx`, `src/app/pricing/layout.tsx`,
  `src/app/contact/page.tsx`, `src/app/privacy/page.tsx`, `src/app/security/page.tsx`,
  `src/app/terms/page.tsx`

### A2. Contact form (`/contact`) is completely non-functional in production — BROKEN, Blocker
`POST /api/contact` returns `503 { "error": "Contact service is not configured" }` because
`SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM_EMAIL` aren't set, with no fallback. The site's
primary "Contact us" conversion path is dead — a real visitor's message is never delivered anywhere.
- Files: `src/app/api/contact/route.ts`, `src/app/contact/page.tsx`

### A3. Inconsistent SMTP-outage handling between `/api/contact` and `/api/support/contact` — BROKEN, Minor
Same missing-SMTP condition, but `/api/support/contact` (used by `/help`) queues the request and
returns `200 { success: true, ticketId, status: "queued" }` instead of hard-failing like `/api/contact`
does. `/api/contact` should adopt the same graceful-degradation pattern.
- Files: `src/app/api/contact/route.ts` vs `src/app/api/support/contact/route.ts`

### A4. `/p/[slug]` shows a generic error instead of "Page not found" for an invalid slug — BROKEN, Minor/Major
`GET /api/proxy/landing-agent/public/<slug>/page` returns `500` (not `404`) for an unknown slug. The
frontend only special-cases `res.status === 404` for the "Page not found" message; a `500` falls
through to a generic "Failed to load page" with no way back to the site. Backend should return 404 for
an unknown slug. Could not test with a real published slug (none discoverable) or `/p/[slug]/thank-you`.
- Files: `src/app/p/[slug]/page.tsx` (~lines 29-38); backend landing-agent public-page handler (apps/api, out of this repo's scope)

### A5. Several public pages fall back to the generic site `<title>` — COSMETIC, Minor
`/contact`, `/faq`, `/security`, `/data-deletion`, `/google-api-disclosure`, `/help`, `/support`,
`/docs/api`, `/verify-email` all render the generic site title instead of a page-specific one — none
export `metadata.title`.

### A6. Orphaned layout files for `/privacy` and `/terms` — dead code, Minor (not deleting per repo convention, flagging only)
`src/app/(marketing)/privacy/layout.tsx` and `.../terms/layout.tsx` exist but there's no `page.tsx`
under either path — the live routes are served by the top-level `app/privacy/page.tsx` /
`app/terms/page.tsx` instead. Leftover from a route migration.

### A — Clean pages
- `/` — full header/footer render correctly; "Request Early Access" invite form correctly wired,
  `POST /api/invite-requests` → `201 { ok: true, status: "WAITLISTED" }`.
- `/faq`, `/help`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/docs/api` — own
  header/footer, real content. `/help` support form correctly wired (see A3). `/help` search is live
  client-side filtering, not a stub.
- `/login`, `/forgot-password`, `/magic-link`, `/agent-login`, `/client-login` — full chrome, Clerk UI
  present, page-specific titles.
- `/accept-invite` — unauthenticated visitor correctly redirected to `/login?invite=required`.
- `/login/sso` — renders correctly; SSO redirect itself not fully verified (auth rate-limit, see
  systemic issue above, was already tripped by other traffic during this run — not attributed as a bug
  in this route).
- `/signup`, `/verify-email` — architecturally wrapped by the same `(marketing)/layout.tsx` as `/login`
  and should render full chrome; **inconclusive** — raw HTML fetch showed no nav/footer but these are
  client components behind Suspense so this may just be pre-hydration streaming text; a live screenshot
  couldn't be captured this run. Worth a quick manual check.
- `/p/[slug]` — see A4 for the invalid-slug handling gap; no real published slug was available to fully verify the happy path.

---

## Group B — Core CRM / Pipeline routes (partial — see coverage gaps)

Scope attempted: `/dashboard`, `/crm`, `/leads`, `/leads/new`, `/leads/import`, `/leads/[id]`,
`/campaigns`, `/campaigns/new`, `/campaigns/[id]`, `/campaigns/[id]/edit`, `/pipeline`, `/inbox`,
`/calendar`, `/funnel`, `/jobs`, `/jobs/[id]`

### B1. `/leads/new` — lead creation is completely broken (CSP root cause) — BROKEN, Blocker
Filled and submitted the new-lead form with fake data; the `POST` to
`https://api.craftmyfunnel.live/leads` never reaches the network — blocked by CSP (see TL;DR). Form's
catch block swallows it as a generic toast error. No lead is created.
- File: `src/app/(dashboard)/leads/new/page.tsx` (line 9: `API_BASE` construction)

### B2. `/pipeline` — shows no data at all, "Failed to load pipeline data" (CSP root cause) — BROKEN, Blocker
All 6 pipeline stage columns show 0 leads / $0 value even though 4 real leads exist in the Lead
Registry. `GET .../leads` and `.../pipeline/stats` both CSP-blocked.
- File: `src/app/(dashboard)/pipeline/page.tsx`

### B3. `/leads/[id]` — always shows "Lead not found", independent Next.js 15 async-params bug — BROKEN, Blocker
Tested with a real, valid lead id (`bb93c8bb-dc2c-470e-9f41-58a04636457f`). The outgoing request is
literally `.../leads/undefined` — **not** the real id — so this bug exists independent of the CSP
issue: `params.id` is read synchronously off what is actually a `Promise` in this Next.js version
(async params), so it's always `undefined`. Needs `use(params)` (or a resolved server-side id) before
reading `.id`.
- File: `src/app/(dashboard)/leads/[id]/page.tsx` (lines 8, 13, 23)

### B4. `/crm` — stub/preview page, not itself broken — PENDING, Minor
Renders a static "Integration Preview" (Salesforce/HubSpot/Pipedrive "Not Connected" cards) explicitly
labeled "under active development." Background settings fetch is CSP-blocked but has no visible effect
since there's no real data to load yet.
- File: `src/app/(dashboard)/crm/page.tsx`

### B5. `/calendar` — meetings never load (CSP root cause), no error state shown — BROKEN, Blocker
`GET .../meetings` CSP-blocked; page silently falls back to "No upcoming meetings" with zero stats
instead of showing an error, so the user can't tell "no meetings" from "failed to load."
- File: `src/app/calendar/page.tsx`

### B6. `/inbox` — redirects to `/approvals` by design; naming may confuse — COSMETIC, Minor
Intentional server redirect (`redirect("/approvals")`), not a bug — but sidebar labels this "Inbox"
while the destination is "Approval Inbox," which could read as a real message inbox that doesn't exist.
- File: `src/app/(dashboard)/inbox/page.tsx`

### B7. `/funnel` — out of scope for this audit group; it's the public marketing page, not an auth'd CRM feature — PENDING, Minor
No "Funnel" link exists in the authenticated sidebar; `/funnel` is actually the logged-out public
landing page (listed in `sessionFreePrefixes`). Worth confirming with product whether an authenticated
funnel-builder screen was ever supposed to exist at this URL.
- Files: `src/app/funnel/page.tsx`, `src/app/funnel/layout.tsx`

### B8. `/jobs` — feature-flagged off, handled gracefully — PENDING, Minor (informational)
Redirects to `/settings/features?feature=jobs` with a clear "Jobs is still hidden" explainer and a
toggle. Deliberate, well-built gating — not a bug. `/jobs/[id]` could not be tested since the feature is
off and no jobs exist for this workspace.

### B — Reference data captured
- 4 real leads exist (ids/emails logged during the run) — usable for retesting B1/B3 once CSP is fixed.
- `/leads` search (`?search=surbhi&status=&channelFilter=`) correctly filters — works as expected.

### B — NOT completed before session cutoff (must be audited separately)
`/dashboard`, `/leads/import`, `/campaigns`, `/campaigns/new`, `/campaigns/[id]`,
`/campaigns/[id]/edit`, `/jobs/[id]` — the agent's own progress note confirms these were queued but
never reached.

---

## Group C — Agents / Studio / Analytics / Automation tools (significantly incomplete — see coverage gaps)

Scope attempted (32 routes) — only a handful were written up before the agent was cut off:
`/agents/builder`, `/agents/swarm`, `/analytics`, `/analytics/ai`, `/analytics/journey`,
`/analytics/roi`, `/studio`, `/playbooks`, `/workflows`, `/workflows/[id]`, `/automations`,
`/automations/approvals`, `/approvals`, `/icp-builder`, `/landing-agent/new`,
`/landing-agent/[id]/{brief,editor,wireframes}`, `/templates`, `/knowledge`, `/intel`, `/marketplace`,
`/team`, `/csv-ingestion`, `/hunter-email-finder`, `/linkedin-runner`, `/scraper-bridge`, `/credits`,
`/monitoring`, `/notifications`, `/onboarding`, `/setup`, `/profile`, `/client`

### C1. Systemic CSP `connect-src` block — confirmed live on `/automations`, `/automations/approvals`,
`/templates`, `/credits` (also breaks the Razorpay checkout script — CSP `script-src` blocks
`checkout.razorpay.com`'s risk-detection bundle too, so purchases are additionally at risk),
`/notifications`, `/monitoring`, `/setup` — BROKEN, Blocker. Source-confirmed (same code pattern) but
not live-reproduced this run: `/workflows`, `/workflows/[id]`, `/playbooks`, `/marketplace`,
`/knowledge`, `/icp-builder` (on submit only), `/analytics/ai`, `/team`. See TL;DR for the fix.

### C2. `/profile` — hardcoded fake user data, missing app chrome — PENDING, Major
Shows a static "John Doe" / "john@example.com" instead of the logged-in user's real Clerk info, and
has none of the app's normal sidebar/topbar. Entirely unimplemented.
- File: `src/app/profile/page.tsx` (100% static, no `useUser()`/data fetch at all)

### C3. `/analytics/roi` — "Last 6 Months" and "Export Report" buttons are dead — PENDING, Minor
Neither `<Button>` has an `onClick` handler; clicking does nothing (confirmed via zero new network
requests).
- File: `src/app/(dashboard)/analytics/roi/page.tsx` (lines ~64-72)

### C4. `/analytics/ai` — all KPIs show 0/0.00, charts empty (likely CSP root cause) — BROKEN, Major
Fetch to `/admin/llm-stats` matches the same CSP-blocked pattern as C1.
- File: `src/app/(dashboard)/analytics/ai/page.tsx` (line 41)

### C — NOT completed before session cutoff (must be audited separately)
`/agents/builder`, `/agents/swarm`, `/analytics/journey`, `/studio`, `/workflows`, `/workflows/[id]`,
`/approvals`, `/icp-builder`, `/landing-agent/new`, `/landing-agent/[id]/brief`,
`/landing-agent/[id]/editor`, `/landing-agent/[id]/wireframes`, `/templates` (form/interaction testing
beyond the load-fetch check), `/knowledge`, `/intel`, `/marketplace`, `/team`, `/csv-ingestion`,
`/hunter-email-finder`, `/linkedin-runner`, `/scraper-bridge`, `/credits` (beyond the fetch check),
`/onboarding`, `/client`. This is the least-covered group — treat it as essentially un-audited beyond
the 4 findings above and re-run in full.

---

## Group D — Admin / Governance / Settings (partial — see coverage gaps)

### D1. `/admin/ai-config` — page never loads, backend endpoint missing entirely — BROKEN, Major
`GET /api/proxy/admin/ai-config` → `404`. No matching backend route in apps/api, and no
`apps/web/src/app/api/admin/ai-config` proxy handler either (unlike `admin/cms`, `admin/invites`,
`admin/users` which do exist). Form never renders.
- File: `src/app/(dashboard)/admin/ai-config/page.tsx`

### D2–D25. CSP `connect-src` block (systemic — see TL;DR) confirmed live on:
`/admin/audit`, `/admin/health`, `/admin/observability`, `/admin/rate-limits`, `/admin/usage`,
`/admin/client-errors`, `/governance/access`, `/governance/audit`, `/governance/guardrails` (worst
case — stuck on "Loading Policy..." forever, no fallback UI at all), `/governance/keys`,
`/settings/agent`, `/settings/approvals`, `/settings/audit`, `/settings/budgeting`,
`/settings/webhooks`. Source-confirmed, same code pattern, not all live-reproduced: `/settings/governance`,
`/settings/governance/analytics`, `/settings/guardrails`, `/settings/hitl`, `/settings/notifications`,
`/settings/sso`, `/settings/team`, `/test-error-logging`. All — BROKEN, Blocker.

### D26. `/admin/invites` — 403 (expected role restriction) silently rendered as misleading empty state — COSMETIC, Minor
Test account isn't ORG_ADMIN/SUPER_ADMIN, so `GET /api/admin/invites` correctly 403s — but the page
swallows any non-OK response and shows "No invite requests yet" / "No invites yet," indistinguishable
from a genuine empty result. Should show a distinct access-denied/error state.
- File: `src/modules/admin/ui/InvitesPage.tsx` (lines ~39-56)

### D27. `/admin/users` — same 403-as-empty-state problem, but worse (no message at all) — COSMETIC, Minor
Renders a fully empty `<tbody>` with zero rows and zero explanation on 403, unlike `/admin/invites`
which at least shows a "no data" message.
- File: `src/modules/admin/ui/UserManagementPage.tsx` (fetch ~lines 38-53, render ~line 209)

### D28. `/governance` — "View Audit Log" button is a dead no-op — BROKEN, Minor
Plain `<button>` with no `onClick`/`href`; nothing happens on click. A working equivalent link
("Audit Logs") already exists in the same page's sub-nav.
- File: `src/app/(dashboard)/governance/page.tsx` (lines ~85-87)

### D — Access-denied pages that degraded gracefully (not bugs)
`/admin/super` (redirects to `/dashboard`), `/admin/cms`, `/admin/cms/edit`, `/admin/content`
(redirect to `/dashboard` per `canAccessCMS` check) — this test account lacks the required role for
all four; behavior is correct RBAC gating, no crash. **Could not verify actual functionality of any of
these four pages** — needs a higher-privilege test account.

### D — Clean / likely-clean pages
- `/admin/users/invite` — intentional redirect to `/admin/users` (use the "+ Invite User" modal there instead). Not a bug.
- `/settings/branding` — form renders correctly, save uses the correct same-origin `/api/settings/branding` route (not the broken cross-origin pattern), no console errors on save. Persistence-after-reload wasn't conclusively re-verified due to shared-browser-session interference this run — recommend a quick manual spot-check.

### D — NOT completed before session cutoff (must be audited separately)
`/admin` (base route), `/settings` (base route), `/settings/crm`, `/settings/features`,
`/settings/general`, `/settings/keys`, `/settings/mailboxes`, `/audit-logs`, `/billing`,
`/dashboard/settings/compliance`, `/security`, `/test-crash`.

---

## Coverage gaps — routes never reached this run (re-audit needed)

- **Group B**: `/dashboard`, `/leads/import`, `/campaigns`, `/campaigns/new`, `/campaigns/[id]`, `/campaigns/[id]/edit`, `/jobs/[id]`
- **Group C**: `/agents/builder`, `/agents/swarm`, `/analytics/journey`, `/studio`, `/workflows`, `/workflows/[id]`, `/approvals`, `/icp-builder`, `/landing-agent/new`, `/landing-agent/[id]/brief`, `/landing-agent/[id]/editor`, `/landing-agent/[id]/wireframes`, `/knowledge`, `/intel`, `/marketplace`, `/team`, `/csv-ingestion`, `/hunter-email-finder`, `/linkedin-runner`, `/scraper-bridge`, `/onboarding`, `/client` (full interaction testing, not just the load fetch)
- **Group D**: `/admin` (base), `/settings` (base), `/settings/crm`, `/settings/features`, `/settings/general`, `/settings/keys`, `/settings/mailboxes`, `/audit-logs`, `/billing`, `/dashboard/settings/compliance`, `/security`, `/test-crash`
- Higher-privilege account needed to actually verify: `/admin/super`, `/admin/cms`, `/admin/cms/edit`, `/admin/content`

All four audit agents were terminated mid-run by the session hitting its API rate limit
(reset ~1am Asia/Kolkata) — this is a session-capacity limit, not a site issue. Re-run the audit for
the routes above once the CSP fix (TL;DR) lands, since most of the untested pages likely share the same
root cause and are worth re-checking together.

---

## Severity/classification summary (of what was actually verified this run)

- **Blocker**: CSP `connect-src` misconfiguration (systemic, ~30+ routes affected), `/leads/new`
  (lead creation), `/pipeline`, `/leads/[id]` (separate async-params bug), `/calendar`,
  `/admin/audit`, `/admin/health`, `/admin/observability`, `/admin/rate-limits`, `/admin/usage`,
  `/admin/client-errors`, `/governance/access`, `/governance/audit`, `/governance/guardrails`,
  `/governance/keys`, `/settings/agent`, `/settings/approvals`, `/settings/audit`,
  `/settings/budgeting`, `/settings/webhooks`, `/contact` form (503, no fallback)
- **Major**: vestigial NextAuth causing 429 lockouts (site-wide), `/admin/ai-config` (missing backend
  endpoint), `/profile` (fake hardcoded data + missing chrome), `/analytics/ai` (CSP)
- **Minor**: `/about`/`/pricing`/`/contact`/`/privacy`/`/security`/`/terms` missing header/footer
  (also arguably Major from an SEO/UX standpoint — treat as Major if these get real traffic),
  `/api/contact` vs `/api/support/contact` inconsistency, `/p/[slug]` wrong error code/message,
  missing page titles (several pages), orphaned layout files, `/inbox` naming, `/crm` stub labeling,
  `/funnel` scope mismatch, `/jobs` feature-gated, `/analytics/roi` dead buttons,
  `/admin/invites` and `/admin/users` misleading empty states on 403, `/governance` dead button
