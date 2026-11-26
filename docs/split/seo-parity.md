# Task 4 SEO parity

Reviewed site page definitions at `98e18b65` and compared the generated sitemap, robots responses, and `llms.txt` with the public routes.

## Gaps and changes

- The sitemap listed 77 of 85 public URLs. Added `/careers`, `/docs/mcp`, `/trust/dpa`, `/trust/subprocessors`, `/industries/b2b-saas`, `/industries/clinics`, `/industries/enterprise-services`, and `/industries/real-estate`. The sitemap now uses the industry dataset and includes open jobs from the careers dataset. The checked-in jobs folder contains no open jobs.
- Ten routes lacked explicit canonicals: `/blog`, `/data-deletion`, `/google-api-disclosure`, `/help`, `/privacy`, `/security`, `/support`, `/terms`, `/trust/dpa`, and `/trust/subprocessors`. `/privacy` also lacked page-specific title and description. Existing page, layout, product, and comparison metadata with absolute canonicals now uses relative canonicals resolved by the root `metadataBase` from `NEXT_PUBLIC_SITE_URL`. Open career postings also get a description.
- Both robots outputs allow all 85 current public pages and point to the configured sitemap. The served text still contains redundant `Allow` entries for `/governance`, `/integrations`, `/glossary`, and `/case-studies`, which have no site page. The structured fallback and served text also differ in their named crawler list. Neither difference blocks a current public route. The existing robots policy stays in place.
- `llms.txt` is a curated production-origin index. It links to 52 current page URLs and to `/llms-full.txt`. All targets were verified. The 33 unlisted pages by prefix were `/` (1), `/about` (1), `/blog` (15), `/careers` (1), `/contact` (1), `/docs` (1), `/industries` (4), `/regions` (4), `/security` (1), `/support` (1), `/trust` (2), and `/vs` (1). Literal origins in noncanonical metadata and editorial links remain outside this parity change.

Changed `apps/site/src/app/sitemap.ts`, site page and layout metadata, `ProductPage.tsx`, `ComparePage.tsx`, and `apps/site/tests/unit/seo-parity.test.ts`. The test derives routes from page files, expands dynamic pages via their route data, and checks exact sitemap membership, unique titles, descriptions, configured canonicals, robots coverage, and the curated LLM links.

## Verification

| Command | Observed result |
| --- | --- |
| `node -v` | `v26.13.0` |
| Targeted Vitest command below against the baseline | Exit 1, two failures and two passes. The first assertion compared 77 sitemap URLs with 85 expected. The second found 10 routes missing at least one required metadata field. |
| `npm run typecheck` | Initial new-test error TS7053 indexing a union of parameter maps. After annotating the maps as `Params[]`, exit 0. |
| Full test and build command below | Exit 0. 13 files and 96 tests passed. Next.js compiled and reported 92 generated static entries, including metadata and error endpoints. |
| `python -` against the built `.next/server/app` artifacts | 85 HTML pages matched the sitemap. All had one unique title, a nonempty description, and one matching canonical on the configured origin. Built robots advertised the configured sitemap. All 53 LLM index links were valid. |
| `git diff --check` and `git diff --cached --check` | Passed. |

Commands in `apps/site` with child-process environment values:

```powershell
cmd.exe /d /c 'set "NEXT_PUBLIC_APP_URL=https://app.example.test" && set "NEXT_PUBLIC_SITE_URL=https://site.example.test" && npm test -- tests/unit/seo-parity.test.ts'
cmd.exe /d /c 'set "NEXT_PUBLIC_APP_URL=https://app.example.test" && set "NEXT_PUBLIC_SITE_URL=https://site.example.test" && npm test && npm run build'
```

Vitest reported a configuration-loader deprecation warning and the build reported a Sentry import deprecation. Both checks passed on the installed runtime. Node 22 and live hosting were outside this verification. Task 5 awaits review.
