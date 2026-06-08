# CraftMyFunnel Assistant Chrome Extension

CraftMyFunnel Assistant is a LinkedIn-assisted lead capture and task companion. It captures visible public profile details and helps users insert prepared draft text into an active LinkedIn textbox for manual review.

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `apps/api/src/extension`.
5. Open the extension popup and set:
   - API base: `http://localhost:3000/api` for local development.
   - API token: your CraftMyFunnel extension token.
   - Extension key: the configured `EXTENSION_API_KEY` value.
   - Team ID: optional, when your account uses team-scoped work.

## Safe Usage

- The extension runs only on LinkedIn profile pages matching `https://www.linkedin.com/in/*`.
- Use Add to CMF to capture visible public details: profile URL, name, headline/designation, and company when visible.
- Use Insert Draft only after clicking into a LinkedIn textbox. The extension inserts text for you to review.
- The extension never clicks LinkedIn action buttons that invite, publish, react, or submit on a user's behalf.
- All LinkedIn actions remain manual. Review every inserted draft before posting manually.

## API Endpoints

- `POST /api/extension/leads`
- `GET /api/extension/tasks/pending`
- `POST /api/extension/tasks/result`

Supported task types:

- `OPEN_PROFILE`
- `ADD_LEAD`
- `INSERT_DRAFT`
- `LOG_MANUAL_LINKEDIN_ACTION`

Supported task labels:

- `ADD_LEAD`
- `OPEN_PROFILE`
- `INSERT_DRAFT`
- `LINKEDIN_TASK`
- `WHATSAPP_TASK`
- `CALL_TASK`
