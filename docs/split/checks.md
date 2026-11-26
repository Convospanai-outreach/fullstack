# Task 3 split checks

Checked `feat/site-app-split-gpt` at `134bb214` with the installed runtime. The package engine range is `>=22 <23`.

```text
node -v
v26.13.0
npm -v
11.6.3
```

## Site

| Exact command in `apps/site` | Result | First error |
| --- | --- | --- |
| `npm run typecheck` | Passed, exit 0 | |
| `npm run lint` | Failed, exit 1 | `npm error Lifecycle script` for `lint`, followed by `npm error Missing script: "lint"` |
| `npm test` | Passed, exit 0. 12 test files and 92 tests. | |
| `npm run build` | Blocked during Next configuration loading, exit 1 | `⨯ Failed to load next.config.mjs, see more info here https://nextjs.org/docs/messages/next-config-error` followed by `Error: NEXT_PUBLIC_APP_URL is required for the production site build` |

## Web

| Exact command in `apps/web` | Result | First error |
| --- | --- | --- |
| `npm run typecheck` | Blocked by missing dependencies, exit 2. TypeScript reported 482 diagnostics. | `../api/src/modules/landing-agent/landingTemplates.ts(1,19): error TS2307: Cannot find module 'zod' or its corresponding type declarations.` |
| `npm test -- run tests/unit/ia-redirects.test.ts tests/unit/siteRedirects.test.ts tests/unit/siteContent.test.ts tests/unit/nav-sections.test.ts tests/unit/site-banner-routes.test.ts` | Passed, exit 0. 5 test files and 41 tests. | |

Vitest was available for the selected web tests. The web typecheck also reported absent modules including `reactflow`, `recharts`, and `swr`. Further typecheck results are pending the web dependency prerequisites.

## Runtime and scope

The first errors point to the missing lint script, missing build configuration, and missing typecheck dependencies. None shows a Node 26 incompatibility. This run only establishes results on Node 26. The site build stopped before compilation.

The only changed file is this report. The checks produced no narrow source or test fix. Node, dependencies, env values, package scripts, and lockfiles were left as provided. Task 4 is pending reviewer approval.
