# Chrome Web Store submission notes (1.2.0)

Text for the store form when uploading `dist/CraftMyFunnel-extension.zip` (archive it as
`CraftMyFunnel-extension-1.2.0.zip`). Check each answer against the build before submitting.
Do not put the reviewer's test account in this file; it goes in the dashboard's "Test instructions".

## What is new in this version

- One-click connect. In the popup's Settings, "Connect to CraftMyFunnel" opens the CraftMyFunnel
  site's connect page. The user signs in there and clicks "Connect the extension"; the site hands the
  extension a sync token. Nothing is copied or pasted, and the shared extension key is gone.
- The manifest adds `externally_connectable`, limited to `https://craftmyfunnel.live/*` and
  `https://www.craftmyfunnel.live/*`. It is not a permission. The extension answers only a page on
  those two origins whose address is `/extension/connect`, and the connect request is checked again in
  the background script (the sender, the page, and that the workspace address matches the site).

No new permissions. The permissions, host permission and content script are the same as 1.1.0.

## Single purpose

Helps a CraftMyFunnel user work their own LinkedIn outreach by hand: save the profile they are
viewing to their CraftMyFunnel workspace, prepare a message, and see which outreach steps are due.

## Description (short)

Capture the LinkedIn profile you are viewing into CraftMyFunnel, prepare your outreach, and see
which LinkedIn steps are due.

## Description (detailed)

CraftMyFunnel Assistant works on the LinkedIn profile you have open.

- Capture: one click saves the visible name, headline, company and location of the profile you are
  viewing. Add your own notes and qualification.
- Sync: send the saved profile to your CraftMyFunnel workspace as a lead, and add it to one of your
  sequences.
- Due steps: see the LinkedIn steps your sequences are waiting on you for, with the suggested
  message. Open the profile, review the message, send it yourself, and mark the step done.

You stay in control. The extension never sends a message, never sends a connection request, and
never clicks anything on LinkedIn for you. It does not run in the background and does not browse
LinkedIn on its own.

A CraftMyFunnel account is needed for sync and due steps. Capture and drafting work without one.

## Authentication

The user connects from the popup, not by typing keys.

1. Settings, "Connect to CraftMyFunnel" opens `https://craftmyfunnel.live/extension/connect?ext=<extension id>`.
2. The user signs in to CraftMyFunnel on that page (the site's normal sign-in).
3. The page shows "Connect the extension". On the click it creates a sync token for the user's
   current team and passes it to the extension with the page's own address.
4. The extension saves it and the page says "Connected to <team>. You can close this tab."

Only the connect page can do this: the page must be on one of the two CraftMyFunnel origins and its
address must be `/extension/connect`. Under "Advanced: connect manually" (closed by default, meant for
self-hosted or development workspaces) a user can paste a workspace address and a sync token instead.
It is not needed to use the extension.

## Permission justifications

- **activeTab**: to read the visible profile details of the LinkedIn profile in the current tab
  when the user clicks Capture, and to hand a draft to that page when the user clicks "Put in
  message box".
- **storage**: to keep the user's captured profile, notes, draft, settings, connection details and
  the last five activity entries on their device.
- **Host permission `https://www.linkedin.com/in/*`**: the content script runs only on LinkedIn
  profile pages. It reads the visible profile details on the user's click, and shows or places a
  draft on the user's click.
- **externally_connectable** (not a permission): lets only the CraftMyFunnel connect page hand over
  the sync token, as described under Authentication.
- **Remote code**: none. All scripts are in the package.

## Data use

- **Collected on the user's action**: the name, headline, company, location and address of the
  LinkedIn profile the user chooses to capture, plus the notes they type. This is website content
  and personally identifiable information about the profile's owner.
- **Where it goes**: it stays on the device until the user clicks Sync, which sends it to the
  CraftMyFunnel workspace the user is connected to.
- **Connection details kept on the device** (`chrome.storage.local`): the workspace address (the
  CraftMyFunnel site the user connected from), the sync token and its expiry date, and the name and id
  of the team the user connected to. The token is sent only to that workspace. There is no extension
  key any more. No LinkedIn password, cookie or session data is read or stored.
- Not sold, not used for advertising, not used for creditworthiness or lending.
- Privacy policy: https://craftmyfunnel.live/privacy

## Notes for the reviewer

Capture and drafting need no account. Sync, the Due tab and Check Connection need the test account
given in the dashboard's "Test instructions".

1. Open any LinkedIn profile (`https://www.linkedin.com/in/...`) and click the extension icon.
2. Prep tab: click "Capture Profile". The visible name and profile address appear.
3. Draft tab: click "Generate Draft". A message is drafted locally; nothing is sent.
4. Settings tab: click "Connect to CraftMyFunnel". A new tab opens at
   `https://craftmyfunnel.live/extension/connect?ext=...`.
5. Sign in with the test account. The page says "The extension will save leads to the team you're in
   now." Click "Connect the extension". It shows "Connected to <team name>. You can close this tab."
6. Close that tab, return to the popup Settings and click "Check Connection". It shows the connected
   account and team.
7. Back on a profile, capture it and click "Sync to CraftMyFunnel" to send it to the workspace, then
   open the Due tab to see the LinkedIn steps waiting on the user. Nothing is sent to LinkedIn by the
   extension.

If the connect page says the link doesn't come from the extension, open it from the popup's button
rather than typing the address.
