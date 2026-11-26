# Task 6 browser smoke tests

The approved environment-template correction is in `3f095f37`. It comments out `NODE_ENV`, `NEXT_RUNTIME`, and `CI` while keeping their explanations and the ten other entries.

Added `apps/site/e2e/public-smoke.spec.ts` for `/`, `/pricing`, `/industries`, `/contact`, and `/privacy`. Each desktop Chromium test checks HTTP 200 and a visible level-one heading, clicks a footer link to a legal page, verifies the destination and its heading, then clicks the home link and verifies the return. The suite stubs the pricing plans response, matching the existing browser suite.

## Checks

Both browser commands ran in `apps/site` with `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` set inline in the child command. No environment values were saved to a file.

| Command | Result |
| --- | --- |
| `node -v` | `v26.13.0` |
| `npm run test:e2e -- --max-failures=1` | Baseline before adding tests, exit 0. All 12 existing tests passed in 2.8 minutes. |
| `npm run typecheck` | Exit 0 before the full browser run and again after cleaning the generated files. |
| `npm run test:e2e` | Exit 0. All 17 tests passed in 1.9 minutes, including all five new smoke cases. |
| `git diff --check`, `git diff --cached --check`, `git show --check --format='%h %s' HEAD` | Passed. |

The local suite verifies rendered pages and same-origin navigation. Live billing and cross-host navigation were outside the smoke coverage. Chromium was already available. The browser runs reported a Sentry import deprecation and a terminal color warning. The Next development server generated a local instructions file and switched the generated type declarations to its development path. Those run artifacts were cleaned before staging.

## Cold-start finding

Run on its own against a fresh dev server, the `/` smoke test failed because the first visit to `/privacy` was compiled on demand and took longer than Playwright's default 5 s assertion timeout. The earlier full run passed only because other tests had already compiled the page. The post-click assertions now use a 30 s timeout, so the tests no longer depend on run order. Two cold single-file runs passed all five tests; the first test takes about 29 s on a cold server.
