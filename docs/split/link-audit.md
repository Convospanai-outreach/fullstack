# Site and app cross-origin link audit

Audit of checked-in page destinations and machine-readable links in `apps/site` and `apps/web`, using the Task 1 route inventory at `a7182a8a`. The tables cover literal destinations and the in-scope call sites that pass them to helpers. API endpoints, assets, pathname tests, test fixtures, and plain-text mentions are outside the link list. For the shared UI NavBar and Footer, the tables record the destination data and origin props supplied by each app. The shared component implementation is outside the worktree folder scope for this task.

## Confirmed fixes

Site Help and Support Assistant rendered three app-only actions relative to the marketing host. `/settings`, `/settings/mailboxes`, and `/leads/import` have web pages and lack a site page or site redirect. Both site renderers now use `resolveHelpActionHref` to prepend `APP_URL` for those exact paths. The same fix covers local help content and the actions returned by web's help search and assistant. Existing marketing, mail, absolute and site-redirected help links keep their destinations.

## Site to web

| File and line | Link | Configured origin |
| --- | --- | --- |
| `apps/site/src/app/blog/[slug]/page.tsx:200` | `${APP_URL}/signup` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/src/app/docs/mcp/page.tsx:99` | `/mcp/connect` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect |
| `apps/site/src/app/help/page.tsx:244` | `resolveHelpActionHref(action.href)` | Yes — `NEXT_PUBLIC_APP_URL` for the three repaired paths |
| `apps/site/src/app/locations/[city]/page.tsx:200` | `${APP_URL}/signup` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/src/app/pricing/page.tsx:145` | `${APP_URL}/signup` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/src/app/pricing/page.tsx:432` | `${APP_URL}/signup` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/src/components/ErrorBoundary.tsx:104` | `${APP_URL}/dashboard` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/src/components/marketing/GlobalCTA.tsx:11` | `${APP_URL}/signup` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/src/components/marketing/home/HomePresidio.tsx:121` | `${APP_URL}/signup?email=${encodeURIComponent(value)}` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/src/components/NavBar.tsx:7` | `appUrl={APP_URL}` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/src/components/support/SupportAssistant.tsx:209` | `resolveHelpActionHref(action.href)` | Yes — `NEXT_PUBLIC_APP_URL` for the three repaired paths |
| `apps/site/src/modules/help/content.ts:47` | `/setup` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect |
| `apps/site/src/modules/help/content.ts:48` | `/dashboard` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect |
| `apps/site/src/modules/help/content.ts:75` | `/setup` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect |
| `apps/site/src/modules/help/content.ts:76` | `/settings/mailboxes` | Yes — `NEXT_PUBLIC_APP_URL` at render time (fixed) |
| `apps/site/src/modules/help/content.ts:101` | `/settings` | Yes — `NEXT_PUBLIC_APP_URL` at render time (fixed) |
| `apps/site/src/modules/help/content.ts:128` | `/leads/import` | Yes — `NEXT_PUBLIC_APP_URL` at render time (fixed) |
| `apps/site/src/modules/help/content.ts:129` | `/dashboard` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect |
| `apps/web/src/modules/help/content.ts:39` | `/setup` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect when rendered on site |
| `apps/web/src/modules/help/content.ts:40` | `/dashboard` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect when rendered on site |
| `apps/web/src/modules/help/content.ts:67` | `/setup` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect when rendered on site |
| `apps/web/src/modules/help/content.ts:68` | `/settings/mailboxes` | Yes — `NEXT_PUBLIC_APP_URL` when rendered on site (fixed) |
| `apps/web/src/modules/help/content.ts:93` | `/settings` | Yes — `NEXT_PUBLIC_APP_URL` when rendered on site (fixed) |
| `apps/web/src/modules/help/content.ts:120` | `/leads/import` | Yes — `NEXT_PUBLIC_APP_URL` when rendered on site (fixed) |
| `apps/web/src/modules/help/content.ts:121` | `/dashboard` | Yes, via the site's `NEXT_PUBLIC_APP_URL` redirect when rendered on site |

## Web to site

Relative web links reach the marketing site through the conditional web redirect. The shared navigation receives `SITE_URL` and the checked-in menu data listed below. Absolute public-host URLs in the copied web blog content continue to use that literal host.

| File and line | Link | Configured origin |
| --- | --- | --- |
| `apps/web/content/blog/ai-agents-vs-traditional-sdr-teams-cost-comparison-and-performance-breakdown.md:32` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/content/blog/ai-agents-vs-traditional-sdr-teams-cost-comparison-and-performance-breakdown.md:49` | `https://craftmyfunnel.live/docs/governed-outreach` | No — literal public origin |
| `apps/web/content/blog/ai-agents-vs-traditional-sdr-teams-cost-comparison-and-performance-breakdown.md:70` | `https://craftmyfunnel.live/docs/deliverability-guardrails` | No — literal public origin |
| `apps/web/content/blog/ai-agents-vs-traditional-sdr-teams-cost-comparison-and-performance-breakdown.md:90` | `https://craftmyfunnel.live/pricing` | No — literal public origin |
| `apps/web/content/blog/ai-agents-vs-traditional-sdr-teams-cost-comparison-and-performance-breakdown.md:90` | `https://craftmyfunnel.live/vs/apollo` | No — literal public origin |
| `apps/web/content/blog/contextual-rag-for-sales-hyper-personalizing-b2b-outreach-with-vector-search.md:56` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/content/blog/contextual-rag-for-sales-hyper-personalizing-b2b-outreach-with-vector-search.md:95` | `https://craftmyfunnel.live/docs/security-architecture` | No — literal public origin |
| `apps/web/content/blog/contextual-rag-for-sales-hyper-personalizing-b2b-outreach-with-vector-search.md:99` | `https://craftmyfunnel.live/docs/governed-outreach` | No — literal public origin |
| `apps/web/content/blog/contextual-rag-for-sales-hyper-personalizing-b2b-outreach-with-vector-search.md:122` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/content/blog/contextual-rag-for-sales-hyper-personalizing-b2b-outreach-with-vector-search.md:122` | `https://craftmyfunnel.live/use-cases` | No — literal public origin |
| `apps/web/content/blog/contextual-rag-for-sales-hyper-personalizing-b2b-outreach-with-vector-search.md:122` | `https://craftmyfunnel.live/docs` | No — literal public origin |
| `apps/web/content/blog/how-to-build-a-sovereign-ai-pipeline-for-enterprise-outbound-sales.md:32` | `https://craftmyfunnel.live/docs/security-architecture` | No — literal public origin |
| `apps/web/content/blog/how-to-build-a-sovereign-ai-pipeline-for-enterprise-outbound-sales.md:94` | `https://craftmyfunnel.live/docs/governed-outreach` | No — literal public origin |
| `apps/web/content/blog/how-to-build-a-sovereign-ai-pipeline-for-enterprise-outbound-sales.md:113` | `https://craftmyfunnel.live/docs/security-architecture` | No — literal public origin |
| `apps/web/content/blog/how-to-build-a-sovereign-ai-pipeline-for-enterprise-outbound-sales.md:113` | `https://craftmyfunnel.live/pricing` | No — literal public origin |
| `apps/web/content/blog/llm-agent-evaluation-frameworks-for-sales-pipeline-automation.md:83` | `https://craftmyfunnel.live/docs/governed-outreach` | No — literal public origin |
| `apps/web/content/blog/llm-agent-evaluation-frameworks-for-sales-pipeline-automation.md:107` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/content/blog/llm-agent-evaluation-frameworks-for-sales-pipeline-automation.md:107` | `https://craftmyfunnel.live/docs` | No — literal public origin |
| `apps/web/content/blog/the-complete-guide-to-email-deliverability-for-ai-generated-cold-outreach.md:52` | `https://craftmyfunnel.live/docs/deliverability-guardrails` | No — literal public origin |
| `apps/web/content/blog/the-complete-guide-to-email-deliverability-for-ai-generated-cold-outreach.md:92` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/content/blog/the-complete-guide-to-email-deliverability-for-ai-generated-cold-outreach.md:113` | `https://craftmyfunnel.live/docs/governed-outreach` | No — literal public origin |
| `apps/web/content/blog/the-complete-guide-to-email-deliverability-for-ai-generated-cold-outreach.md:115` | `https://craftmyfunnel.live/docs/deliverability-guardrails` | No — literal public origin |
| `apps/web/content/blog/the-complete-guide-to-email-deliverability-for-ai-generated-cold-outreach.md:115` | `https://craftmyfunnel.live/faq` | No — literal public origin |
| `apps/web/content/settings/navigation.json:8` | `/products/fluid-funnel-engine` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:12` | `/products/buyer-signals` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:16` | `/products/ai-outreach` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:20` | `/products/human-layer` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:24` | `/products/covospan-edge` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:34` | `/industries/cybersecurity` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:39` | `/industries/managed-it-cloud` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:44` | `/industries/sap-erp` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:49` | `/industries/gcc-services` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:54` | `/industries/staffing` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:59` | `/industries/dpdp-consulting` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:64` | `/industries` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:73` | `/regions/india` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:77` | `/regions/united-states` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:81` | `/regions/europe` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:85` | `/regions/uae` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:89` | `/regions/canada` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:93` | `/locations` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:102` | `/about` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:106` | `/vs` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:110` | `/careers` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:114` | `/security` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:118` | `/contact` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:127` | `/blog` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:131` | `/docs` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:135` | `/help` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:139` | `/faq` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/content/settings/navigation.json:143` | `/support` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to the shared NavBar |
| `apps/web/src/app/(dashboard)/admin/cms/page.tsx:13` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/(marketing)/accept-invite/page.tsx:50` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/(marketing)/login/page.tsx:157` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/(marketing)/signup/page.tsx:116` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/api/help/assistant/route.ts:57` | `/help#${article.slug}` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/api/track/click/[trackingKey]/route.ts:12` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/client/page.tsx:66` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/not-found.tsx:26` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/not-found.tsx:32` | `/pricing` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/not-found.tsx:47` | `/industries` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/not-found.tsx:55` | `/locations` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/not-found.tsx:63` | `/faq` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/p/[slug]/thank-you/page.tsx:62` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/pricing/manage/page.tsx:173` | `${SITE_URL}/contact` | Yes — `NEXT_PUBLIC_SITE_URL` |
| `apps/web/src/app/pricing/manage/page.tsx:471` | `${SITE_URL}/contact` | Yes — `NEXT_PUBLIC_SITE_URL` |
| `apps/web/src/app/pricing/manage/page.tsx:529` | `${SITE_URL}/contact` | Yes — `NEXT_PUBLIC_SITE_URL` |
| `apps/web/src/components/analytics/ConsentBanner.tsx:109` | `/privacy` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/auth/AuthLayout.tsx:21` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/auth/RoleLoginPage.tsx:36` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/dashboard/settings/BillingSettings.tsx:109` | `/pricing` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/dashboard/WorkspaceHelpPanel.tsx:92` | `/help` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/Footer.tsx:7` | `siteUrl={SITE_URL}` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to shared footer |
| `apps/web/src/components/marketing/GlobalCTA.tsx:12` | `${SITE_URL}/pricing` | Yes — `NEXT_PUBLIC_SITE_URL` |
| `apps/web/src/components/marketing/site/kit.tsx:144` | `/products/covospan-edge` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/marketing/site/kit.tsx:145` | `/security` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/MobileMenu.tsx:99` | `/help` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/Nav.tsx:12` | `/about` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/Nav.tsx:13` | `/faq` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/Nav.tsx:14` | `/pricing` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/components/NavBar.tsx:7` | `siteUrl={SITE_URL}` | Yes — `NEXT_PUBLIC_SITE_URL` supplied to shared navigation |
| `apps/web/src/lib/navSections.ts:111` | `/docs/api` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/modules/help/content.ts:94` | `/contact` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/modules/help/content.ts:146` | `/pricing` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/modules/help/content.ts:147` | `/contact` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/modules/help/content.ts:160` | `/help` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/modules/help/content.ts:161` | `/contact` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |

## Metadata and discovery links from web

Web's `metadataBase` reads `NEXT_PUBLIC_SITE_URL` at `apps/web/src/app/layout.tsx:19`. Explicit absolute values and relative HTML discovery links retain the origins shown below. This is a source inventory of web links. The site SEO parity check belongs to Task 4.

| File and line | Link | Configured origin |
| --- | --- | --- |
| `apps/web/next.config.mjs:68` | `/docs` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:68` | `/llms.txt` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/api/openapi.json/route.ts:20` | `${origin}/contact` | Request origin first. `NEXT_PUBLIC_SITE_URL` is a fallback |
| `apps/web/src/app/api/openapi.json/route.ts:25` | `${origin}/terms` | Request origin first. `NEXT_PUBLIC_SITE_URL` is a fallback |
| `apps/web/src/app/layout.tsx:23` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/src/app/layout.tsx:27` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/src/app/layout.tsx:43` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/src/app/layout.tsx:113` | `/llms.txt` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/layout.tsx:114` | `/llms-full.txt` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/layout.tsx:117` | `/docs/api` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/app/layout.tsx:126` | `https://craftmyfunnel.live/#organization` | No — literal public origin |
| `apps/web/src/app/layout.tsx:128` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/src/app/layout.tsx:156` | `https://craftmyfunnel.live/#website` | No — literal public origin |
| `apps/web/src/app/layout.tsx:157` | `https://craftmyfunnel.live` | No — literal public origin |
| `apps/web/src/app/layout.tsx:160` | `https://craftmyfunnel.live/#organization` | No — literal public origin |
| `apps/web/src/app/layout.tsx:165` | `https://craftmyfunnel.live/#software` | No — literal public origin |
| `apps/web/src/app/pricing/manage/layout.tsx:8` | `https://craftmyfunnel.live/pricing` | No — literal public origin |
| `apps/web/src/app/pricing/manage/layout.tsx:13` | `https://craftmyfunnel.live/pricing` | No — literal public origin |
| `apps/web/src/lib/apiCatalog.ts:23` | `/docs` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/lib/apiCatalog.ts:23` | `/llms.txt` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/src/lib/apiCatalog.ts:44` | `${origin}/docs/api` | Yes — `NEXT_PUBLIC_SITE_URL` through `getBaseSiteUrl()` |
| `apps/web/src/lib/apiCatalog.ts:56` | `${origin}/llms.txt` | Yes — `NEXT_PUBLIC_SITE_URL` through `getBaseSiteUrl()` |
| `apps/web/src/lib/apiCatalog.ts:71` | `${origin}/docs` | Yes — `NEXT_PUBLIC_SITE_URL` through `getBaseSiteUrl()` |
| `apps/web/src/lib/pricing.ts:50` | `https://craftmyfunnel.live/pricing` | No — literal public origin |
| `apps/web/src/lib/pricing.ts:69` | `https://craftmyfunnel.live` | No — literal public origin |

## Configured cross-host redirects

The pricing checkout cancellation return takes precedence over the generic marketing pricing path. The web-side return is local to web and therefore absent from this cross-host redirect table.

| File and line | Link | Configured origin |
| --- | --- | --- |
| `apps/site/next.config.mjs:76` | `/login/:path*` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:76` | `/signup` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:76` | `/forgot-password` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:76` | `/magic-link` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:76` | `/verify-email` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:77` | `/accept-invite` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:77` | `/client-login` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:77` | `/agent-login` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:77` | `/complete-profile` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:77` | `/onboarding` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:78` | `/setup` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:78` | `/dashboard/:path*` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:78` | `/checkout/:path*` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:78` | `/credits` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:78` | `/extension/:path*` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:79` | `/client/:path*` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:79` | `/superadmin/:path*` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:79` | `/p/:path*` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:79` | `/mcp/connect` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:79` | `/cms/:path*` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/site/next.config.mjs:85` | `/pricing?checkout=cancelled → ${APP_URL}/pricing/manage` | Yes — `NEXT_PUBLIC_APP_URL` |
| `apps/web/next.config.mjs:127` | `/` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:127` | `/about` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:127` | `/blog/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:127` | `/careers/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:127` | `/contact` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:127` | `/docs/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:128` | `/faq` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:128` | `/help` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:128` | `/industries/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:128` | `/locations/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:128` | `/pricing` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:128` | `/privacy` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:129` | `/products/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:129` | `/regions/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:129` | `/security` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:129` | `/support` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:129` | `/terms` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:130` | `/trust/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:130` | `/vs/:path*` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:130` | `/data-deletion` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:130` | `/google-api-disclosure` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:131` | `/robots.txt` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:131` | `/sitemap.xml` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:131` | `/manifest.webmanifest` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:131` | `/llms.txt` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:131` | `/llms-full.txt` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:155` | `/use-cases → /industries` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:156` | `/use-cases/cybersecurity → /industries/cybersecurity` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:157` | `/use-cases/security-services → /industries/gcc-services` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:158` | `/use-cases/facility-management → /industries/gcc-services` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:159` | `/use-cases/managed-it-cloud → /industries/managed-it-cloud` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:160` | `/use-cases/managed-services → /industries/managed-it-cloud` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:161` | `/use-cases/ai-data-erp → /industries/sap-erp` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:162` | `/use-cases/staffing → /industries/staffing` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:163` | `/use-cases/consulting → /industries/dpdp-consulting` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:164` | `/use-cases/training → /industries` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:165` | `/use-cases/regions/:region → /regions/:region` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |
| `apps/web/next.config.mjs:166` | `/funnel → /` | Yes, via the web redirect when `NEXT_PUBLIC_SITE_URL` is set |

## Unused web layouts

| File | Imports or route dependency |
| --- | --- |
| `apps/web/src/app/(marketing)/privacy/layout.tsx:1` | No imports or page descendants found. Web `/privacy` is a conditional redirect to the site page. |
| `apps/web/src/app/(marketing)/terms/layout.tsx:1` | No imports or page descendants found. Web `/terms` is a conditional redirect to the site page. |

Each segment contains only its metadata layout. The scoped source and docs search found the component declarations and references in the existing `apps/web/FRONTEND_AUDIT.md`, which is documentation. The parent marketing layout receives route children and imports the navigation and footer. Neither segment has a page for it to wrap.

## Review and verification

- Relative web links depend on the configured web-to-site redirect. Literal origins in blog content, metadata, and pricing schema are recorded for review. Live host configuration and browser navigation remain unverified.
- Source inventory compared against tracked page definitions and both redirect configurations. `git ls-files` and `rg -n` supplied the file and line references. The retained diagnostic routes were outside this change.
- `node --version` reported `v26.13.0`. The dependency-free `node --input-type=module` check passed 4 tests covering both help datasets, unaffected destinations, both site renderers, and the three paths' route ownership. Node emitted module-type warnings when loading the TypeScript sources directly. The package-managed checks on the repo's Node 22 range belong to Task 3.
