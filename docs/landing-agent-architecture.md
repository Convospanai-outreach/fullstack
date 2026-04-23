# Landing Agent Architecture

## Summary
Landing Agent adds a constrained, team-scoped funnel builder flow with:
- prompt + optional text/PDF asset intake
- brief extraction (`challenge`, `solution`, `benefit`)
- 3 wireframe generation
- constrained GrapesJS editing
- publish to `/p/[slug]`
- anonymous lead and event ingestion

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
