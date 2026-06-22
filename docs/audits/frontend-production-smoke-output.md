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

## Runtime Issues Resolved

In prior checks, public browser pages repeatedly attempted `/api/auth/session` and received `500` or `429` with `CLIENT_FETCH_ERROR` and NextAuth `NO_SECRET` errors.

Following the user's environment variable update and Production redeployment:
- Direct `/api/auth/session` now returns `200 OK` with `{}`.
- NextAuth client-side calls on `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, `/funnel`, `/help`, and `/faq` now successfully return `200 OK` without any `500` or `429` errors.
- Client-side error logs for NextAuth are no longer emitted.

However, the pages still make client-side requests to `/api/auth/session` and `/api/auth/_log` because the custom domain is still serving branch `main` (commit `4367d7bc374d4a6db9151b00bc40078fca1e2416`), which lacks the Codex branch provider list patch.

## Follow-Up Auth Session Recheck

Fresh public HTTPS checks on the redeployed production build:
- Direct `/api/auth/session` returned `200 OK` with `{}`.
- Vercel production logs no longer show NextAuth `NO_SECRET`.
- The source fix in the Codex branch (`apps/web/src/app/providers.tsx`) remains **NOT PROVEN ON PRODUCTION** because the custom domain serves `main`.

Local production smoke after the `providers.tsx` fix:
- Showed `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, and `/funnel` each made zero `/api/auth/session` browser requests and emitted no NextAuth console errors.

## Artifacts

Screenshots captured:

- `output/playwright/mobile-home.png`
- `output/playwright/mobile-funnel.png`

## Validation Commands

| Command | Result |
| --- | --- |
| `npm run lint --workspace apps/web` | Passed in 182.3s with one warning |
| `npm run typecheck --workspace apps/web` | Passed in 212.4s |
| `npm run build --workspace apps/web` | Passed in 805.2s |

## Verdict

No blank homepage, public-route, cinematic crash, dashboard-auth, or `/api/proxy` recursion blocker was found. The direct NextAuth `NO_SECRET` issue is resolved in Vercel Production. The client-side session-free fix is not yet live in Production because the custom domain serves branch `main` rather than the Codex branch. The session-noise risk is reduced (the calls now succeed with 200) but remains active until the Codex branch providers fix reaches `main`.

