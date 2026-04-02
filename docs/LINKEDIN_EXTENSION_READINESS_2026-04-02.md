# LinkedIn Extension Readiness (2026-04-02)

## Scope
- Extension UI/runtime: `apps/web/src/extension`
- Web proxy bridge: `apps/web/src/app/api/proxy/[...path]/route.ts`
- API integration routes: `apps/api/routes/extension/**`

## Current Integration Path

1. Extension calls: `http://localhost:3000/api/proxy/extension/*`
2. Web catch-all proxy forwards to API origin (`API_INTERNAL_ORIGIN` / `API_BASE_URL` / `http://localhost:3001`)
3. API serves extension routes under `/extension/*`

## Implemented In This Pass

### Backend hardening

1. Added shared extension auth helper:
- `apps/api/routes/extension/_lib/auth.ts`
- Validates `x-extension-key`
- Supports either:
  - `Authorization: Bearer <token>` where token can be user id or session token
  - `x-user-id`
- Resolves team membership for team-scoped operations

2. Updated API routes to use shared auth:
- `apps/api/routes/extension/auth/validate/route.ts`
- `apps/api/routes/extension/tasks/route.ts`
- `apps/api/routes/extension/tasks/complete/route.ts`
- `apps/api/routes/extension/push/route.ts`
- `apps/api/routes/extension/action/route.ts`

3. Team safety improvements:
- Task completion now verifies job belongs to authenticated user's team(s)
- Push route writes/upserts leads scoped by `teamId`
- Action route no longer depends on browser session context and uses extension auth instead

4. Task lifecycle improvement:
- `/extension/tasks` now fetches `pending` + `queued`
- Fetched tasks are marked `processing` to reduce duplicate dispatching

### Extension runtime improvements

1. `background.js`
- Added robust task dispatch flow
- Added deferred re-execution after navigation
- Added pending-task map by tab
- Added `EXTENSION_ACTION` backend call path
- Improved auth header normalization (`Bearer ...`)
- Kept offline queue behavior for profile push events

2. `content.js`
- Added direct manual `LIKE_POST` handler (popup parity)
- Added `CONNECT` task support
- Added pending navigation signal for background-managed tab navigation

3. `popup.js` + `popup.html`
- Improved connection error rendering
- Manual like now logs to `/extension/action` via `EXTENSION_ACTION`
- Clarified token input text: "User id or session token"

4. `manifest.json`
- Bumped version to `1.1.0`
- Added `tabs` permission required by improved tab orchestration
- Added `https://*.convospan.com/*` host permission for hosted environments

## Validation Performed

1. API compile:
- `npm run build --workspace apps/api`
- Result: PASS

2. Extension script syntax checks:
- `node --check apps/web/src/extension/background.js`
- `node --check apps/web/src/extension/content.js`
- `node --check apps/web/src/extension/popup.js`
- Result: PASS

## Remaining Hosting Checklist

1. Packaging/release process
- Add a documented packaging step for Chrome Web Store submission assets

2. Auth maturity
- Current flow still depends on extension key + user/session token; production may require a dedicated short-lived extension token issuance flow

3. End-to-end smoke
- Run live smoke in browser:
  - Validate auth from popup
  - Scrape profile push
  - Poll `/tasks`, execute `VIEW_PROFILE` / `LIKE_POST` / `CONNECT`
  - Confirm `/tasks/complete` updates job records

4. Store assets
- Ensure store-required assets/icons/screenshots and privacy disclosures are present for publishing
