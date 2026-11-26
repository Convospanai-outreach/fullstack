# Site and app route inventory

Baseline `14cc0d5b` has 38 Next.js page patterns in `apps/site` and 133 in `apps/web`, with no page pattern defined in both. The table also includes the browser-facing `/cms` HTML handler in web.

Paths omit route groups such as `(dashboard)` and preserve dynamic segments such as `[slug]`. Route handlers for APIs and metadata, assets, and error boundaries are outside the page inventory. “Lives in” names the implementation. Incoming redirects are described in the disposition or the routing notes.

All site page patterns below have a web-to-site redirect in `apps/web/next.config.mjs` when `NEXT_PUBLIC_SITE_URL` is configured. “Move to site (complete)” records that the page already lives in site. The `/pricing` checkout cancellation exception is listed below.

| Path | Lives in | Purpose | Disposition |
| --- | --- | --- | --- |
| `/` | site | Marketing homepage | Move to site (complete) |
| `/about` | site | Company overview and positioning | Move to site (complete) |
| `/blog` | site | Blog index | Move to site (complete) |
| `/blog/[slug]` | site | Individual blog article | Move to site (complete) |
| `/careers` | site | Careers and open positions | Move to site (complete) |
| `/careers/[slug]` | site | Job description and application | Move to site (complete) |
| `/contact` | site | Marketing contact form | Move to site (complete) |
| `/data-deletion` | site | Product-wide data deletion instructions | Move to site (complete) |
| `/docs` | site | Public documentation hub | Move to site (complete) |
| `/docs/api` | site | REST API and webhooks reference | Move to site (complete) |
| `/docs/deliverability-guardrails` | site | Deliverability and compliance guide | Move to site (complete) |
| `/docs/governed-outreach` | site | Governed outreach and human approval guide | Move to site (complete) |
| `/docs/mcp` | site | Public MCP integration guide | Move to site (complete) |
| `/docs/security-architecture` | site | Public security architecture guide | Move to site (complete) |
| `/faq` | site | Frequently asked questions | Move to site (complete) |
| `/google-api-disclosure` | site | Google API data use disclosure | Move to site (complete) |
| `/help` | site | Public help center and search | Move to site (complete) |
| `/industries` | site | Industry and regional guide index | Move to site (complete) |
| `/industries/[slug]` | site | Industry-specific guide | Move to site (complete) |
| `/locations` | site | Local market and sales hub index | Move to site (complete) |
| `/locations/[city]` | site | City-specific sales hub guide | Move to site (complete) |
| `/pricing` | site | Public plans and pricing | Move to site (complete) |
| `/privacy` | site | Privacy policy | Move to site (complete) |
| `/products/ai-outreach` | site | AI outreach product overview | Move to site (complete) |
| `/products/buyer-signals` | site | Buyer Signals product overview | Move to site (complete) |
| `/products/covospan-edge` | site | Covospan Edge product overview | Move to site (complete) |
| `/products/fluid-funnel-engine` | site | Fluid Funnel Engine product overview | Move to site (complete) |
| `/products/human-layer` | site | Human Layer product overview | Move to site (complete) |
| `/regions/[slug]` | site | Regional outreach guide | Move to site (complete) |
| `/security` | site | Public security overview | Move to site (complete) |
| `/support` | site | Public support intake | Move to site (complete) |
| `/terms` | site | Terms of service | Move to site (complete) |
| `/trust/dpa` | site | Data Processing Agreement template | Move to site (complete) |
| `/trust/subprocessors` | site | Subprocessor list | Move to site (complete) |
| `/vs` | site | Competitor comparison index | Move to site (complete) |
| `/vs/apollo` | site | Apollo comparison | Move to site (complete) |
| `/vs/instantly` | site | Instantly comparison | Move to site (complete) |
| `/vs/lemlist` | site | Lemlist comparison | Move to site (complete) |
| `/accept-invite` | web | Team invitation acceptance | Stay in web |
| `/accounts` | web | Account list and account information | Stay in web |
| `/admin` | web | Role-gated platform administration entry | Redirect to `/superadmin` in web |
| `/admin/ai-config` | web | Administrative AI configuration | Stay in web |
| `/admin/audit` | web | Administrative audit log | Stay in web |
| `/admin/client-errors` | web | Client error reports | Stay in web |
| `/admin/cms` | web | Authenticated CMS dashboard | Stay in web |
| `/admin/cms/edit` | web | Authenticated content editor | Stay in web |
| `/admin/content` | web | Legacy admin content entry | Redirect to `/admin/cms` in web |
| `/admin/health` | web | Administrative health overview | Stay in web |
| `/admin/invites` | web | Invitation administration | Stay in web |
| `/admin/observability` | web | System observability | Stay in web |
| `/admin/rate-limits` | web | Rate limit administration | Stay in web |
| `/admin/usage` | web | Administrative usage reporting | Stay in web |
| `/admin/users` | web | User administration | Stay in web |
| `/admin/users/invite` | web | Legacy user invitation entry | Redirect to `/admin/users` in web |
| `/agent-login` | web | Agent sign-in entry | Stay in web |
| `/agents/builder` | web | Agent builder | Stay in web |
| `/agents/swarm` | web | Agent swarm controls | Stay in web |
| `/analytics` | web | Analytics landing entry | Redirect to `/analytics/roi` in web |
| `/analytics/ai` | web | AI usage and activity analytics | Stay in web |
| `/analytics/content` | web | Content analytics | Stay in web |
| `/analytics/journey` | web | Journey analytics | Stay in web |
| `/analytics/roi` | web | ROI analytics | Stay in web |
| `/approvals` | web | Legacy team approvals entry | Redirect to `/inbox?tab=approvals` in web |
| `/audit-logs` | web | Legacy audit log entry | Redirect to `/settings/audit` in web |
| `/automations` | web | Automation management | Stay in web |
| `/automations/approvals` | web | Legacy automation approvals entry | Redirect to `/inbox?tab=approvals` in web |
| `/billing` | web | Account billing | Stay in web |
| `/calendar` | web | Product calendar and meetings | Stay in web |
| `/caller` | web | Calling workspace | Stay in web |
| `/campaigns` | web | Campaign list | Stay in web |
| `/campaigns/[id]` | web | Campaign details and controls | Stay in web |
| `/campaigns/new` | web | Campaign creation | Stay in web |
| `/checkout/[productId]` | web | Product-specific checkout | Stay in web |
| `/client` | web | Client portal | Stay in web |
| `/client-login` | web | Client sign-in entry | Stay in web |
| `/cms` | web | Decap CMS browser entry served by an HTML handler | Stay in web |
| `/command-center` | web | Operations command center | Stay in web |
| `/complete-profile` | web | Required profile completion | Stay in web |
| `/content/calendar` | web | Content planning calendar | Stay in web |
| `/content/instagram-funnel` | web | Instagram funnel setup and management | Stay in web |
| `/content/plans` | web | Content plan list | Stay in web |
| `/content/plans/[id]` | web | Individual content plan | Stay in web |
| `/credits` | web | Credits and usage | Stay in web |
| `/crm` | web | Legacy CRM entry | Redirect to `/settings/crm` in web |
| `/crystal-knows` | web | Crystal Knows workspace | Stay in web |
| `/csv-ingestion` | web | CSV ingestion workspace | Stay in web |
| `/dashboard` | web | Product dashboard | Stay in web |
| `/dashboard/settings/compliance` | web | Compliance settings | Stay in web |
| `/edge` | web | Edge runtime workspace | Stay in web |
| `/extension/connect` | web | Browser extension connection entry | Stay in web |
| `/extension/connect/[state]` | web | State-bound browser extension connection | Stay in web |
| `/forgot-password` | web | Password recovery request | Stay in web |
| `/governance` | web | Product governance overview | Stay in web |
| `/governance/access` | web | Governance access controls | Stay in web |
| `/governance/audit` | web | Legacy governance audit entry | Redirect to `/settings/audit` in web |
| `/governance/firewall` | web | Governance firewall controls | Stay in web |
| `/governance/guardrails` | web | Legacy governance guardrails entry | Redirect to `/settings/guardrails` in web |
| `/governance/keys` | web | Legacy governance keys entry | Redirect to `/settings/keys` in web |
| `/hunter-email-finder` | web | Hunter email finder | Stay in web |
| `/icp-builder` | web | Ideal customer profile builder | Stay in web |
| `/inbox` | web | Replies and approval inbox | Stay in web |
| `/intel` | web | Sales intelligence workspace | Stay in web |
| `/jobs` | web | Background job list | Stay in web |
| `/jobs/[id]` | web | Individual background job | Stay in web |
| `/knowledge` | web | Team knowledge workspace | Stay in web |
| `/landing-agent` | web | Landing agent project list | Stay in web |
| `/landing-agent/[id]/brief` | web | Landing project brief | Stay in web |
| `/landing-agent/[id]/editor` | web | Landing page editor | Stay in web |
| `/landing-agent/[id]/wireframes` | web | Landing project wireframes | Stay in web |
| `/landing-agent/new` | web | Landing project creation | Stay in web |
| `/leads` | web | Lead list | Stay in web |
| `/leads/[id]` | web | Lead detail | Stay in web |
| `/leads/import` | web | Lead import | Stay in web |
| `/leads/new` | web | Lead creation | Stay in web |
| `/leads/org-chart` | web | Lead organization chart | Stay in web |
| `/linkedin-runner` | web | LinkedIn runner workspace | Stay in web |
| `/login` | web | Product sign-in | Stay in web |
| `/login/sso` | web | Single sign-on entry | Stay in web |
| `/magic-link` | web | Passwordless sign-in | Stay in web |
| `/marketplace` | web | Product marketplace | Stay in web |
| `/mcp/connect` | web | Product MCP connection flow | Stay in web |
| `/monitoring` | web | Product health monitoring | Stay in web |
| `/notifications` | web | Product notifications | Stay in web |
| `/onboarding` | web | Legacy onboarding entry | Redirect to `/setup` in web |
| `/p/[slug]` | web | Published customer landing page | Stay in web |
| `/p/[slug]/data-deletion` | web | Data deletion information for a published customer page | Stay in web |
| `/p/[slug]/thank-you` | web | Published customer funnel confirmation | Stay in web |
| `/pipeline` | web | Sales pipeline | Stay in web |
| `/playbooks` | web | Team playbook templates | Stay in web |
| `/pricing/manage` | web | Product billing and checkout management | Stay in web |
| `/profile` | web | User profile | Stay in web |
| `/runtime` | web | Runtime observability | Stay in web |
| `/scraper-bridge` | web | Scraper integration workspace | Stay in web |
| `/settings` | web | Settings landing entry | Redirect to `/settings/general` in web |
| `/settings/agent` | web | AI sales agent settings | Stay in web |
| `/settings/approvals` | web | Legacy approval settings entry | Redirect to `/inbox?tab=approvals` in web |
| `/settings/audit` | web | Team audit log | Stay in web |
| `/settings/branding` | web | Branding settings | Stay in web |
| `/settings/budgeting` | web | Budget and usage controls | Stay in web |
| `/settings/crm` | web | CRM integration settings | Stay in web |
| `/settings/crystal-knows` | web | Crystal Knows integration settings | Stay in web |
| `/settings/custom-properties` | web | Custom property settings | Stay in web |
| `/settings/domain-health` | web | Sending domain health | Stay in web |
| `/settings/features` | web | Feature controls | Stay in web |
| `/settings/general` | web | General team settings | Stay in web |
| `/settings/governance` | web | Team governance settings | Stay in web |
| `/settings/governance/analytics` | web | Governance analytics | Stay in web |
| `/settings/guardrails` | web | Team guardrails settings | Stay in web |
| `/settings/hitl` | web | Legacy human approval entry | Redirect to `/inbox?tab=approvals` in web |
| `/settings/keys` | web | API key settings | Stay in web |
| `/settings/mailboxes` | web | Connected mailbox setup and controls | Stay in web |
| `/settings/notifications` | web | Notification preferences | Stay in web |
| `/settings/payments` | web | Payment integration settings | Stay in web |
| `/settings/social` | web | Social account connections | Stay in web |
| `/settings/sso` | web | Team single sign-on configuration | Stay in web |
| `/settings/suppressions` | web | Email suppression settings | Stay in web |
| `/settings/team` | web | Team membership and roles | Stay in web |
| `/settings/webhooks` | web | Webhook configuration | Stay in web |
| `/setup` | web | Product setup wizard | Stay in web |
| `/signup` | web | Product registration | Stay in web |
| `/sovereign` | web | Data residency and sovereignty controls | Stay in web |
| `/studio` | web | Message Control Studio | Stay in web |
| `/superadmin` | web | Platform superadmin console | Stay in web |
| `/team` | web | Legacy team settings entry | Redirect to `/settings/team` in web |
| `/templates` | web | Product template library | Stay in web |
| `/test-crash` | web | Opt-in crash reporting diagnostic | UNSURE — confirm retention of opt-in diagnostics |
| `/test-error-logging` | web | Opt-in client error logging diagnostic | UNSURE — confirm retention of opt-in diagnostics |
| `/tools` | web | Product tools hub | Stay in web |
| `/verify-email` | web | Account email verification | Stay in web |
| `/whatsapp` | web | WhatsApp workspace | Stay in web |
| `/workflows` | web | Workflow list | Stay in web |
| `/workflows/[id]` | web | Individual workflow | Stay in web |

## Routing notes

- `/pricing` stays on site for public pricing. A request with `checkout=cancelled` goes to web `/pricing/manage` from either service. Web evaluates that return before its marketing redirect.
- `/dashboard/settings` is a redirect-only web URL. It points to `/settings`, which redirects to `/settings/general`. The distinct `/dashboard/settings/compliance` page stays in web.
- The legacy `/use-cases` family and `/funnel` are redirect-only. Site resolves them to the corresponding industries, regions, or homepage paths. Web adds the same redirects to the site origin when `NEXT_PUBLIC_SITE_URL` is configured.
- Site directs product entry paths listed in `apps/site/next.config.mjs` to the app origin, including sign-in, sign-up, checkout, setup, and published customer pages under `/p`. The `(marketing)` folder in web groups several authentication pages whose implementations stay in web.
- `/cms` stays in web. Its HTML handler can redirect to the CMS canonical host. The configured CMS hostname and login callback remain unverified.
- `/test-crash` and `/test-error-logging` are present in web and guarded by `ENABLE_TEST_DIAGNOSTIC_ROUTES`. Their retention is a reviewer decision.
- Both checked-in CMS redirect files contain zero rules. Deployed redirects, environment settings, and DNS were outside this inventory.
