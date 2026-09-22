# CraftMyFunnel Assistant Chrome Extension

CraftMyFunnel Assistant is a V1 Chrome Web Store approval-safe LinkedIn profile capture and outreach prep assistant.

## V1 Approval Scope

Version 1.0.0 is intentionally minimal and approval-safe: **V1 approval scope: visible LinkedIn profile capture and outreach prep only.** The active extension only captures visible public details from the LinkedIn profile page the user is currently viewing after an explicit user click:

- profile URL
- name
- headline when visible or safely available from the page title/meta fallback
- current company only when confidently visible in the top profile card
- location only when confidently visible

The capture is scoped to the visible top profile card, stored locally with `chrome.storage`, and can be copied from the popup for manual review. Missing optional fields are shown as `Not detected from visible profile.` Version 1 does not poll background jobs, open tabs, insert drafts into LinkedIn, send LinkedIn actions, read cookies, or request broad host access.

The popup provides:

- capture module for name, profile URL, and optional visible headline/company/location
- lead notes for user-added company, role, location, industry, notes, priority, and lead type
- outreach angle selection
- local draft generation for manual copy only
- manual qualification
- local save with optional best-effort workspace sync if configured
- activity log with the last five events
- settings for workspace URL, optional token, default tone, and default outreach angle

Active Version 1 permissions:

- `storage`
- `activeTab`
- LinkedIn profile host access only: `https://www.linkedin.com/in/*`

## V2 Preview (task polling) — sideload only

Version 2 adds authenticated **task polling**: the extension polls
`GET /api/extension/tasks/pending`, opens the requested LinkedIn profile in a tab, or inserts a
drafted message into the LinkedIn composer **for the user to review and send**, and reports the
result to `POST /api/extension/tasks/result`. It is **assistive, not autonomous** — it never clicks
Send or Connect on the user's behalf.

V2 ships as a **separate sideload build**, not in the published store listing:

- `manifest.json` (v1.0.0) is unchanged and remains the published, approval-safe store build.
- `manifest.v2.json` (v2.0.0) is the v2 preview manifest, adding `alarms`, `notifications`, `tabs`,
  and the CraftMyFunnel API host (declared as `optional_host_permissions` for arbitrary
  self-hosted origins), plus `options_page`.
- The v2 task worker is **merged into `background.js`** behind a capability gate
  (`typeof chrome.alarms !== "undefined"`), so it is completely inert under the v1 manifest (which
  grants no `alarms`). The old `background.v2-planned.js` remains only as a historical reference and
  is not loaded by either manifest.
- The `EXECUTE_TASK` executor lives in `content.js`; settings (API base, token, extension key,
  team id, poll interval) are entered on `options.html`.

Server-side, LinkedIn sequence steps enqueue extension tasks best-effort
(`sequenceService.executeLinkedInRun` → `enqueueExtensionTask`): chat/message steps with a drafted
body enqueue `INSERT_DRAFT`, every other LinkedIn step enqueues `OPEN_PROFILE`. The human
`PipelineService` task remains the fallback for teams without the extension.

The disabled V2 request-recorder/data-normalizer architecture is scaffolded in TypeScript:

- `src/config/feature-flags.ts` keeps `linkedinApiCapture`, backend sync, drafting, outreach, and connection automation disabled.
- `src/linkedin/request-recorder.ts` classifies LinkedIn Voyager/GraphQL/search-style URLs but stores nothing while `linkedinApiCapture` is false.
- `src/linkedin/response-classifier.ts` finds safe MiniProfile/Profile-shaped payloads.
- `src/linkedin/profile-normalizer.ts` normalizes safe profile objects into `CMFProspect`.
- `src/prospects/prospect.types.ts` defines the shared prospect shape.
- `src/extension/background/message-router.ts` defines V1/V2 message names and the disabled V2 response.

Permissions that may be requested later, only when the matching features are ready and disclosed:

- `tabs` for opening or selecting LinkedIn profile tabs for user-reviewed tasks
- `alarms` for background task polling
- `notifications` for task status updates
- CraftMyFunnel API host permissions for authenticated lead sync and task results

Version 2 planned features include API-assisted profile parsing, backend lead sync, task polling, draft insertion into a user-selected LinkedIn editor, and manual task logging. These are disabled in Version 1 feature flags and should not be activated without a manifest permission review.

## Permission Philosophy

The active manifest stays narrow:

- no `<all_urls>`
- no `cookies`
- no `history`
- no `downloads`
- no `webRequest` or `webRequestBlocking`
- no `debugger`
- no `nativeMessaging`
- no extra `scripting` permission

V1 uses content-script DOM inspection and `chrome.runtime` messages only. It does not inject page-context scripts, remote code, `eval`, `new Function`, inline script tags, cookies, tokens, auth headers, or session data.

The content script is passive on page load. It reads visible profile details only after the popup sends a user-triggered `CMF_CAPTURE_VISIBLE_PROFILE` message.

## Profile Intelligence Engine

V1 profile capture avoids LinkedIn private APIs and unstable DOM-first scraping. It uses a browser-visible Profile Intelligence Engine:

1. Structured Metadata Layer: title, meta description, Open Graph, Twitter tags, and JSON-LD Person blocks.
2. Visible Hero Extraction Layer: largest/strongest visible text and nearby hero lines in the top 35 percent of the viewport.
3. Experience Intelligence Layer: first current experience only, with education/certification/course/publication text rejected.
4. Location Intelligence Layer: profile intro/top-card location patterns only.
5. Confidence Engine: each field gets a value, source, and numeric confidence score.
6. Conflict Resolution: current experience beats hero, hero beats metadata, and education is never accepted as company.
7. DOM selectors: used only as the final fallback.

Each captured field records a value, source, and confidence in the popup debug panel. The Deep Capture Debug button shows only page title/meta, JSON-LD Person data, source layer output, winners, and top viewport lines used for extraction. It does not expose cookies, tokens, auth headers, or session data.

Future enrichment provider interfaces are prepared in `src/prospects/enrichment.types.ts` for backend enrichment, Apollo, People Data Labs, Proxycurl, and NetJana signals. They are intentionally not implemented or called in V1.

## Intentionally Disabled

The following are intentionally disabled in the V1 approval build:

- LinkedIn API-assisted capture
- automatic backend lead sync
- automatic message sending
- connection automation
- outreach automation
- background crawling or scheduled LinkedIn jobs
- inbox, private message, hidden-data, cookie, token, or auth-header collection

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `apps/api/src/extension`.
5. Open a LinkedIn profile page.
6. Use the popup to capture the visible profile, prepare a draft, qualify the lead, and save locally.

## Build Chrome Web Store ZIP

From the repository root:

```powershell
Compress-Archive -Force -Path apps/api/src/extension/manifest.json,apps/api/src/extension/background.js,apps/api/src/extension/content.js,apps/api/src/extension/popup.html,apps/api/src/extension/popup.js,apps/api/src/extension/popup.css,apps/api/src/extension/utils.js,apps/api/src/extension/icons,apps/api/src/extension/README.md -DestinationPath dist/craftmyfunnel-extension-v1.zip
```

The ZIP intentionally contains only the active V1 extension files and docs.

## Build & Sideload the V2 Preview

The v2 preview is not published. To load-test it locally, stage the files with `manifest.v2.json`
renamed to `manifest.json`:

```powershell
$src = "apps/api/src/extension"
$dst = "dist/chrome-extension-v2"
Remove-Item -Recurse -Force $dst -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "$src/manifest.v2.json" "$dst/manifest.json"
Copy-Item "$src/background.js","$src/content.js","$src/popup.html","$src/popup.js","$src/popup.css","$src/options.html","$src/options.js","$src/utils.js" $dst
Copy-Item "$src/icons" $dst -Recurse
```

Then in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/chrome-extension-v2`.
Open the extension's Options, set the API base (e.g. `https://craftmyfunnel.live/api`), paste an
extension token (minted via the app) and the extension key, save, then run a LinkedIn sequence step
and confirm the profile opens / the draft is inserted for review. Publishing v2 to the Chrome Web
Store is a separate decision and triggers a new permission review.

## Manual Test Checklist

- LinkedIn profile page: click Capture Profile and confirm name plus profile URL capture.
- LinkedIn profile page with missing optional fields: confirm `Not detected from visible profile.` appears.
- LinkedIn company page or search page: confirm popup asks for a LinkedIn profile page.
- Non-LinkedIn page: confirm popup asks for a LinkedIn profile page.
- Generate Draft works with only name and profile URL.
- Copy Capture and Copy Draft copy text manually.
- Save Lead succeeds locally when workspace sync is unavailable.
- Activity Log keeps only the last five events.
- Settings page stores workspace URL, optional token, default tone, and default angle locally.

## Safe Usage

- The extension runs only on LinkedIn profile pages matching `https://www.linkedin.com/in/*`.
- Version 1 captures visible public details only.
- Version 1 does not click LinkedIn action buttons that invite, publish, react, or submit on a user's behalf.
- All outreach actions remain manual and outside the Version 1 extension scope.
