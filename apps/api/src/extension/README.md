# CraftMyFunnel Assistant Chrome Extension

CraftMyFunnel Assistant is prepared for phased Chrome Web Store approval under one extension listing and one extension ID.

## Version 1 Approval Scope

Version 1.0.0 is intentionally minimal. The active extension only captures visible public details from the LinkedIn profile page the user is currently viewing:

- profile URL
- name
- headline/designation
- company when visible

The capture is stored locally with `chrome.storage` and can be copied from the popup for manual review. Version 1 does not sync to CraftMyFunnel servers, poll background jobs, open tabs, insert drafts, send LinkedIn actions, read cookies, or request broad host access.

Active Version 1 permissions:

- `storage`
- `activeTab`
- LinkedIn profile host access only: `https://www.linkedin.com/in/*`

## Version 2 Planned Scope

Version 2 features remain planned but inactive in the current manifest. The previous background task worker is preserved as `background.v2-planned.js` and is not referenced by `manifest.json` or packaged for Version 1 approval. `options.html` and `options.js` are also not referenced by the active Version 1 manifest.

Permissions that may be requested later, only when the matching features are ready and disclosed:

- `tabs` for opening or selecting LinkedIn profile tabs for user-reviewed tasks
- `alarms` for background task polling
- `notifications` for task status updates
- CraftMyFunnel API host permissions for authenticated lead sync and task results

Version 2 planned features include backend lead sync, task polling, draft insertion into a user-selected LinkedIn editor, and manual task logging. These are disabled in Version 1 feature flags and should not be activated without a manifest permission review.

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `apps/api/src/extension`.
5. Open a LinkedIn profile page.
6. Use the sidebar or popup to capture the visible profile.

## Safe Usage

- The extension runs only on LinkedIn profile pages matching `https://www.linkedin.com/in/*`.
- Version 1 captures visible public details only.
- Version 1 does not click LinkedIn action buttons that invite, publish, react, or submit on a user's behalf.
- All outreach actions remain manual and outside the Version 1 extension scope.
