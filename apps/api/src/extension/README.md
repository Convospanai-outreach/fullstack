# CraftMyFunnel Assistant Chrome Extension

CraftMyFunnel Assistant is a V1 Chrome Web Store approval-safe LinkedIn profile capture and outreach prep assistant.

## V1 Approval Scope

The published build (version 1.1.0) is intentionally minimal and approval-safe: **V1 approval scope: visible LinkedIn profile capture and outreach prep only.** The active extension only captures visible public details from the LinkedIn profile page the user is currently viewing after an explicit user click:

- profile URL
- name
- headline when visible or safely available from the page title/meta fallback
- current company only when confidently visible in the top profile card
- location only when confidently visible

The capture is scoped to the visible top profile card, stored locally with `chrome.storage`, and can be copied from the popup for manual review. Missing optional fields are shown as `Not detected from visible profile.` The published build does not poll background jobs, open tabs on its own, send LinkedIn actions, read cookies, or request broad host access. It opens a profile tab, or places a draft in the LinkedIn message box, only when the user clicks that button in the popup (see "Due steps" below).

The popup provides:

- capture module for name, profile URL, and optional visible headline/company/location
- lead notes for user-added company, role, location, industry, notes, priority, and lead type
- outreach angle selection
- local draft generation for manual copy only
- manual qualification
- local save with optional best-effort workspace sync if configured
- activity log with the last five events
- after a lead is synced, adding it to one of the team's switched-on sequences (a lead with no email yet joins once it has one)
- settings for workspace URL, optional token, default tone, and default outreach angle
- a connection check that names the CraftMyFunnel team and account the sync token belongs to (the token is tied to the team it was generated in)
- a Due tab listing the LinkedIn sequence steps that are waiting on the signed-in person (see "Due steps" below)

Active Version 1 permissions:

- `storage`
- `activeTab`
- LinkedIn profile host access only: `https://www.linkedin.com/in/*`

## Due steps (1.1.0)

A LinkedIn step in a CraftMyFunnel sequence waits for a person. The Due tab lists the steps waiting
on the person whose sync token is saved (`GET /api/extension/steps`), fetched when the popup opens.
There is no background polling, so the build needs no permission beyond 1.0.0's.

For each step the popup shows who it is for, what to do and the suggested message, with these buttons:

- **Open profile** opens the person's LinkedIn profile in a new tab.
- **Put in message box** (on that person's profile) hands the draft to the page. If LinkedIn's
  chat with that person is open and its message box is empty, the draft is placed in it. Otherwise
  the page shows the draft in a small panel with a Copy button, and places it once the user opens
  that chat. A chat is recognised by the person's name in its heading, so a chat left open with
  someone else is never filled; when the name cannot be matched the draft stays in the panel to be
  copied. Text the user has already typed is never replaced. The extension never clicks Message,
  Connect or Send.
- **Copy message** copies the draft.
- **Mark done** tells CraftMyFunnel the user did the step (`POST /api/extension/steps/<id>/done`),
  and the sequence moves on to its next step.

Settings stay where 1.0.0 saved them (`settings.workspaceUrl`, `settings.extensionKey`,
`settings.syncToken` in `chrome.storage.local`), so an update keeps the connection. A saved
`https://www.craftmyfunnel.live` address is sent to `https://craftmyfunnel.live`, because the www
address redirects and the browser does not follow a redirect for these requests.

## Not in the extension

The extension has no background task polling, no options page and no second manifest. The earlier
sideload-only preview that polled `GET /api/extension/tasks/pending` and opened profile tabs was
removed in 1.1.0; the Due tab replaces it, and every action there starts with a click in the popup.

Server-side, LinkedIn sequence steps still enqueue extension tasks best-effort
(`sequenceService.executeLinkedInRun` → `enqueueExtensionTask`). Nothing in the extension reads that
queue: due steps come from `GET /api/extension/steps`, and marking a step done closes its queued
task. The human `PipelineService` task remains the fallback for teams without the extension.

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
Compress-Archive -Force -Path apps/api/src/extension/manifest.json,apps/api/src/extension/background.js,apps/api/src/extension/content.js,apps/api/src/extension/popup.html,apps/api/src/extension/popup.js,apps/api/src/extension/popup.css,apps/api/src/extension/utils.js,apps/api/src/extension/icons -DestinationPath dist/craftmyfunnel-extension-v1.zip
```

The ZIP intentionally contains only the active extension files.
`scripts/package-extension.ps1` builds the same file set into `dist/CraftMyFunnel-extension.zip`.
The listing text and permission answers for the store form are in `STORE_SUBMISSION.md`.

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
- Due tab, not connected: it asks to connect CraftMyFunnel in Settings.
- Due tab, connected, with a LinkedIn step waiting in a sequence: the step is listed with its message.
- Open profile opens the profile in a new tab; reopening the popup there shows the Due tab with that step first.
- Put in message box with LinkedIn's message box closed: the draft panel appears on the page, and the draft lands in the box after clicking Message.
- Put in message box with text already typed in the message box: the typed text is left alone.
- Put in message box with a chat open with someone else: that chat is left alone and the draft stays in the panel.
- If Message opens LinkedIn's full messaging page instead of the chat overlay, the panel is gone with the profile page; use Copy message in the popup instead.
- Mark done removes the step from the list, and the sequence's next step is scheduled in CraftMyFunnel.
- Updating from 1.0.0 keeps the saved workspace URL, extension key and sync token.

## Safe Usage

- The extension runs only on LinkedIn profile pages matching `https://www.linkedin.com/in/*`.
- Version 1 captures visible public details only.
- Version 1 does not click LinkedIn action buttons that invite, publish, react, or submit on a user's behalf.
- All outreach actions remain manual and outside the Version 1 extension scope.
