# LinkedIn Chrome Web Store Approval Plan

Date: 2026-06-20
Agent: approval-readiness-agent
Status: READY_FOR_NEXT_STAGE

## Scope

This is a documentation-only Chrome Web Store approval plan for the CraftMyFunnel LinkedIn helper extension. No code changes, package changes, migrations, production database operations, or Chrome Web Store submission actions were made.

DB Phase 5 remains `BLOCKED_EXTERNAL_ACCESS`. This workstream does not continue DB migration work.

## Repo Evidence Inspected

- Existing readiness doc: `docs/LINKEDIN_EXTENSION_READINESS_2026-04-02.md`
- Extension README: `apps/api/src/extension/README.md`
- Active V1 background worker: `apps/api/src/extension/background.js`
- Planned V2 worker, not active in manifest: `apps/api/src/extension/background.v2-planned.js`
- Extension manifest: `apps/api/src/extension/manifest.json`
- Backend extension routes: `apps/api/routes/extension/**`

## Current Integration Path From Existing Readiness Doc

`docs/LINKEDIN_EXTENSION_READINESS_2026-04-02.md` describes this integration path:

1. Extension calls `http://localhost:3000/api/proxy/extension/*`.
2. Web catch-all proxy forwards to API origin using `API_INTERNAL_ORIGIN`, `API_BASE_URL`, or `http://localhost:3001`.
3. API serves extension routes under `/extension/*`.

The same doc also notes backend routes under:

```text
apps/api/routes/extension/**
```

Important approval context: the older readiness doc describes broader backend hardening and task flows, while `apps/api/src/extension/README.md` and `manifest.json` describe the active Version 1 approval build as a narrow visible-profile capture assistant.

## Repository Packaging Note

The external Chrome extension package is not fully checked into this repo as a separate release package. This repo contains an extension source folder under:

```text
apps/api/src/extension
```

The final Chrome Web Store ZIP must be built from the intended active V1 files only, and the submitted artifact must be checked separately before upload.

## Chrome Store Approval Risks

- LinkedIn host permissions: even narrow `https://www.linkedin.com/in/*` host access can draw review attention because it operates on a third-party social/professional network.
- `tabs` permission: planned V2 uses tab orchestration, but active V1 manifest does not request `tabs`; adding it increases review risk.
- Content scripts: active V1 uses a content script on LinkedIn profile pages. The review must show it only captures visible profile details after user action.
- Profile data capture: visible public profile details are still personal data and require clear disclosure, retention, and deletion language.
- `CONNECT` / `LIKE_POST` automation: older/planned flows mention connect/like actions. These should remain out of the first submission.
- Background polling: planned V2 includes polling. This should remain disabled or absent from the first submission.
- Backend task execution: routes exist for extension tasks and results; the submitted V1 extension should not automatically execute mass tasks.
- LinkedIn terms/platform risk: avoid claims or behavior that implies scraping, automation, or bypassing LinkedIn controls.

## Safest First Submission Scope

Submit the narrowest V1 scope:

- Manual user-triggered profile capture only.
- Capture only visible public profile details on the currently open LinkedIn profile page.
- No mass automation.
- No background scraping.
- No auto-connect.
- No auto-like.
- No automated LinkedIn message sending.
- No scheduled background crawling.
- No private message, cookie, token, or auth-header collection.
- Optional backend sync only when user explicitly configures and triggers save.

## Permissions Minimization Checklist

- Keep manifest version 3.
- Keep permissions limited to:
  - `activeTab`
  - `storage`
- Keep host permissions limited to:
  - `https://www.linkedin.com/in/*`
- Do not add:
  - `<all_urls>`
  - `tabs`
  - `alarms`
  - `cookies`
  - `history`
  - `downloads`
  - `webRequest`
  - `webRequestBlocking`
  - `debugger`
  - `nativeMessaging`
  - broad `scripting` permissions
- Confirm `background.v2-planned.js` is not referenced by `manifest.json`.
- Confirm task polling is disabled or absent from the submitted build.
- Confirm content script reads visible profile page details only after explicit popup action.
- Confirm no remote code, `eval`, inline scripts, or dynamic script injection.

## Privacy Disclosure Checklist

- Public privacy URL available before submission:
  - `https://www.craftmyfunnel.live/privacy`
- Public data deletion URL available before submission:
  - `https://www.craftmyfunnel.live/data-deletion`
- Public support URL available before submission:
  - `https://www.craftmyfunnel.live/support`
- Disclose collected data:
  - LinkedIn profile URL
  - name
  - visible headline
  - visible current company
  - visible location
  - user-entered notes and qualification fields
- Disclose purpose:
  - user-triggered lead preparation and manual outreach drafting.
- Disclose storage:
  - local Chrome storage for V1 state.
  - optional workspace sync only when configured and triggered by the user.
- Disclose deletion:
  - clear local data in extension.
  - request workspace deletion through support or data deletion page.
- Disclose that the extension does not collect LinkedIn credentials, cookies, session tokens, private messages, or hidden profile data.
- Avoid implying automated outreach, automatic lead scraping, or guaranteed meeting outcomes.

## Store Asset Checklist

- Icons:
  - 16x16
  - 32x32 if included by packaging process
  - 48x48
  - 128x128
- Screenshots:
  - popup on a LinkedIn profile page
  - captured visible profile details
  - manual draft preparation
  - settings / local save state
- Description:
  - clearly states manual visible-profile capture and outreach prep.
  - avoids automation and scraping language.
  - states user action is required.
- Support URL:
  - `https://www.craftmyfunnel.live/support`
- Privacy URL:
  - `https://www.craftmyfunnel.live/privacy`
- Optional:
  - short promotional tile
  - large promotional tile
  - demo video if requested by review.

## Smoke Test Checklist

- Install unpacked from `apps/api/src/extension`.
- Confirm manifest references `background.js`, not `background.v2-planned.js`.
- Login/auth validate if backend sync is enabled for the smoke.
- Open a LinkedIn `/in/` profile page.
- Trigger manual profile capture from the popup.
- Confirm captured fields are limited to visible public profile data.
- Push profile to backend only through the explicit save/sync action.
- Confirm task polling is disabled or manual-only in the submitted build.
- Confirm no background scraping occurs while browsing LinkedIn.
- Confirm no automatic connect, like, message, or follow action occurs.
- Confirm non-LinkedIn pages do not capture profile data.
- Confirm LinkedIn company/search pages are rejected or handled as unsupported for V1.
- Confirm extension can clear local data.
- Confirm no secrets or user tokens appear in screenshots, console logs, or exported ZIP.

## Packaging Checklist For Chrome Web Store Submission

- Build the ZIP from active V1 files only.
- Include:
  - `manifest.json`
  - `background.js`
  - `content.js`
  - `popup.html`
  - `popup.js`
  - `popup.css`
  - `utils.js`
  - `icons/**`
  - `README.md` if desired
- Exclude:
  - `background.v2-planned.js`
  - `options.html`
  - `options.js`
  - unused V2 TypeScript scaffolding
  - source maps containing secrets
  - local env files
  - test artifacts
- Inspect the ZIP before upload.
- Install the exact ZIP locally and rerun the smoke test.
- Confirm the Web Store listing permissions match the manifest permissions.
- Confirm public privacy/support URLs are live before submission.

## Submission Recommendation

Submit V1 as a manual, user-triggered LinkedIn profile capture and outreach prep assistant. Keep backend task polling, tab orchestration, connect/like automation, and background scraping out of the first Chrome Web Store submission.

No code changes should be made as part of this approval plan unless a separate implementation task is explicitly opened.
