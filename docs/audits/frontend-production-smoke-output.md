# Frontend Production Smoke Output

Date: 2026-06-22
Agent: approval-readiness-agent
Status: NEEDS_REPLAN

## Scope

Tested production public HTTPS at `https://www.craftmyfunnel.live` using Chromium with host resolver override:

`--host-resolver-rules=MAP www.craftmyfunnel.live 76.76.21.21,MAP craftmyfunnel.live 76.76.21.21`

This bypasses local DNS entries that map the public domains to `127.0.0.1` while preserving HTTPS host verification.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Homepage loads without server error | PASS | Browser status `200`, final URL `https://www.craftmyfunnel.live/` |
| Homepage does not render a blank page | PASS | Desktop body text present; mobile recheck found `textLength: 6187`, `canvasCount: 1`, `linkCount: 26` |
| CinematicHome / GSAP / Lenis / React Three Fiber runtime errors | PASS with warning | No page exceptions observed. Chromium emitted WebGL performance warnings: `GPU stall due to ReadPixels`; not a functional crash. |
| `/funnel` route loads publicly | PASS with runtime risk | Browser status `200`, final URL `https://www.craftmyfunnel.live/funnel`, content present |
| `/login` route still loads | PASS | Browser status `200`, title `Sign In | CraftMyFunnel` |
| `/dashboard` redirects or requires auth | PASS | Browser final URL `https://www.craftmyfunnel.live/login?callbackUrl=%2Fdashboard` |
| `/api/proxy` behavior is not recursively targeting itself | PASS by HTTP surface | `HEAD /api/proxy` and `HEAD /api/proxy/health` returned `401 Unauthorized` with Clerk signed-out headers, not recursive redirects or self-targeting loops |
| NavBar links are usable on public pages | PASS basic | Browser found nav links/buttons on homepage, `/funnel`, login, terms, and approval pages; mobile menu rendered |
| Approval pages hidden behind auth | PASS | `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/terms`, `/contact` all returned public `200` |
| Obvious mobile-breaking layout issues | PASS basic visual with caveat | Mobile screenshots for `/` and `/funnel` show rendered hero, nav, canvas, and text. A lower HUD/metric label is very close to the bottom edge but not a blank-page blocker. |

## Runtime Issues Observed

Public browser pages repeatedly attempted `/api/auth/session` and received `500` or `429`, producing NextAuth client errors such as:

- `[next-auth][error][CLIENT_FETCH_ERROR] There is a problem with the server configuration`
- `[next-auth][error][CLIENT_FETCH_ERROR] Too many requests`

Observed on `/funnel`, `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` during Chromium smoke. These did not block page rendering, but they are production runtime noise and should be treated as a frontend smoke risk before controlled beta.

## Artifacts

Screenshots captured:

- `output/playwright/mobile-home.png`
- `output/playwright/mobile-funnel.png`

## Validation Commands

| Command | Result |
| --- | --- |
| `npm run lint --workspace apps/web` | Timed out after 180s; not counted as pass |
| `npm run typecheck --workspace apps/web` | Passed in 206s |
| `npm run build --workspace apps/web` | Timed out after 600s; not counted as pass |

## Verdict

No blank homepage, public-route, cinematic crash, dashboard-auth, or `/api/proxy` recursion blocker was found. Overall frontend smoke remains `NEEDS_REPLAN` because public pages emit `/api/auth/session` client errors and local lint/build validation did not complete.
