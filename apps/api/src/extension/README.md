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

## V2 Planned Architecture

Version 2 features remain planned but inactive in the current manifest. The previous background task worker is preserved as `background.v2-planned.js` and is not referenced by `manifest.json`. `options.html` and `options.js` are also not referenced by the active Version 1 manifest.

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

## Capture Extraction Strategy

V1 profile capture avoids LinkedIn private APIs and unstable DOM-first scraping. It uses layered browser-visible extraction:

1. profile URL from `window.location.href` without query params
2. JSON-LD `Person` data from `script[type="application/ld+json"]`
3. Open Graph, Twitter, and standard meta title/description tags
4. `document.title`
5. visible text in the top 45 percent of the viewport
6. top-card DOM selectors as the final fallback

Each captured field records a value, source, and confidence in the popup debug panel. The Deep Capture Debug button shows only page title/meta, JSON-LD Person data, and top viewport lines used for extraction. It does not expose cookies, tokens, auth headers, or session data.

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
