# Landing Agent Architecture

## Summary
Landing Agent adds a constrained, team-scoped funnel builder flow with:
- prompt + optional text/PDF asset intake
- brief extraction (`challenge`, `solution`, `benefit`)
- 3 wireframe generation
- constrained GrapesJS editing
- publish to `/p/[slug]`
- anonymous lead and event ingestion
- optional campaign linkage through `linkedCampaignId`

## Data Model
- `LandingCampaign`:
  - team-scoped campaign context and selected wireframe state.
  - optional link to existing `Campaign` via `linkedCampaignId`.
- `LandingAsset`:
  - stores text and PDF-derived content for brief generation.
- `LandingWireframeOption`:
  - stores 3 generated options and section structure JSON.
- `LandingPage`:
  - draft/published page state, slug, version, rendered JSON, editor state.
- `LandingLead`:
  - anonymous lead form captures with UTM/referrer/session/version metadata.
- `LandingEvent`:
  - lean event stream (`page_view`, `cta_click`, `form_start`, `form_submit`, `scroll_depth`).

## Buyer Intel And Netjana Relationship

Netjana buyer-signal support exists in the main Intel pipeline, not as automatic direct landing-page generation today.

Current active path:

1. Netjana posts buyer-intent payloads to `POST /webhooks/netjana-intel`.
2. `netjanaIntelService` validates, normalizes, scores, and matches signals to leads/campaigns.
3. The service persists `ShadowSignal`, `ScrapingJob`, lead `marketContext`, and `enrichedData.netjana`.
4. Trusted signals become `Netjana Intelligence` knowledge items.
5. Hot verified signals can queue `INTEL_FOLLOWUP_REFRESH`, draft an email, create activity, and request approval.

Landing Agent has a `BuyerIntelAdapter` at `apps/api/src/modules/landing-agent/adapters/BuyerIntelAdapter.ts`, but that adapter currently returns `status: "stub"` unless a real provider is configured. So the visual architecture should show:

- solid line: Netjana -> Intel -> Lead/Campaign/Knowledge -> email and LinkedIn outreach.
- solid line: Landing Agent -> public page -> `LandingLead`/`LandingEvent`.
- dotted line: Netjana/Knowledge -> Landing Agent brief generation, because direct buyer-intel injection is optional and not configured by default.

## API Surfaces
- Authenticated dashboard:
  - `POST /landing-agent/campaigns`
  - `GET /landing-agent/campaigns/:id`
  - `POST /landing-agent/campaigns/:id/assets`
  - `POST /landing-agent/campaigns/:id/brief`
  - `POST /landing-agent/campaigns/:id/wireframes`
  - `POST /landing-agent/campaigns/:id/select-wireframe`
  - `PUT /landing-agent/campaigns/:id/editor-state`
  - `POST /landing-agent/campaigns/:id/publish`
- Anonymous public:
  - `GET /landing-agent/public/:slug/page`
  - `POST /landing-agent/public/:slug/lead`
  - `POST /landing-agent/public/:slug/event`

## Security and Governance
- Public ingress remains subject to existing public rate limiting in proxy.
- Honeypot field (`website`) is validated server-side for anonymous event/lead endpoints.
- Render payload is sanitized server-side before persistence.
- Publish writes governance audit trail (`LANDING_PAGE_PUBLISHED`).
- Optional approval gate is available through publish payload (`requireApproval`).

## Web Flow
- Dashboard:
  - `/landing-agent/new`
  - `/landing-agent/[id]/brief`
  - `/landing-agent/[id]/wireframes`
  - `/landing-agent/[id]/editor`
- Public:
  - `/p/[slug]`
  - `/p/[slug]/thank-you`
