# Chrome Web Store submission notes (1.2.0)

Text for the store form when uploading `dist/CraftMyFunnel-extension.zip`. Check each answer against
the build before submitting.

## What is new in this version

- Settings has a "Connect to CraftMyFunnel" button. It opens the CraftMyFunnel connect page, where
  the user signs in and approves; the extension then receives its sync token. Pasting a shared
  extension key is no longer needed.
- `externally_connectable` now lists `https://craftmyfunnel.live/*` and
  `https://www.craftmyfunnel.live/*` so that page can message the extension. No permission or host
  permission was added. It is not expected to add an install warning; verify in the store
  dashboard.
- Profile capture drops LinkedIn's unread-count prefix from the page title, as in "(3) Jane Doe".

Earlier, in 1.1.0:

- A "Due" tab lists the LinkedIn steps that the user's CraftMyFunnel sequences are waiting on them for.
- From that list the user can open the person's profile, copy the suggested message, have it placed
  in LinkedIn's message box for review, and mark the step done.
- After saving a profile, the user can add it to one of their CraftMyFunnel sequences.
- A connection check shows which CraftMyFunnel account and team the extension is connected to.

No new permissions.

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

## Permission justifications

- **activeTab**: to read the visible profile details of the LinkedIn profile in the current tab
  when the user clicks Capture, and to hand a draft to that page when the user clicks "Put in
  message box".
- **storage**: to keep the user's captured profile, notes, draft, settings and the last five
  activity entries on their device.
- **Host permission `https://www.linkedin.com/in/*`**: the content script runs only on LinkedIn
  profile pages. It reads the visible profile details on the user's click, and shows or places a
  draft on the user's click.
- **Remote code**: none. All scripts are in the package.

## Data use

- **Collected on the user's action**: the name, headline, company, location and address of the
  LinkedIn profile the user chooses to capture, plus the notes they type. This is website content
  and personally identifiable information about the profile's owner.
- **Where it goes**: it stays on the device until the user clicks Sync, which sends it to the
  CraftMyFunnel workspace the extension is connected to. A profile the user chose to sync before
  connecting is sent when they connect.
- **Sign-in data**: the sync token the CraftMyFunnel connect page hands over (or that the user
  pastes in under "Advanced: connect manually"), the workspace address, the team name and the
  token's expiry date are stored on the device. The token is sent only to that workspace. No LinkedIn password, cookie or session
  data is read or stored.
- Not sold, not used for advertising, not used for creditworthiness or lending.
- Privacy policy: https://craftmyfunnel.live/privacy

## Notes for the reviewer

1. Open any LinkedIn profile (`https://www.linkedin.com/in/...`) and click the extension icon.
2. Prep tab: click "Capture Profile". The visible name and profile address appear.
3. Draft tab: click "Generate Draft". A message is drafted locally; nothing is sent.
4. Sync and the Due tab need a CraftMyFunnel account: in Settings click "Connect to CraftMyFunnel",
   sign in on the page that opens and approve. Settings then shows the connected team.
