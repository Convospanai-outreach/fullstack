# Landing Agent API Examples

## Create Campaign
```bash
curl -X POST "$API/landing-agent/campaigns" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q3 Pipeline Builder",
    "prompt": "We help B2B teams automate outbound safely with approvals.",
    "framework": "PAS"
  }'
```

## Add Text Asset
```bash
curl -X POST "$API/landing-agent/campaigns/<campaignId>/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Product brochure content goes here.",
    "sourceName": "brochure-snippet"
  }'
```

## Generate Brief
```bash
curl -X POST "$API/landing-agent/campaigns/<campaignId>/brief" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Generate Wireframes
```bash
curl -X POST "$API/landing-agent/campaigns/<campaignId>/wireframes" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Select Wireframe
```bash
curl -X POST "$API/landing-agent/campaigns/<campaignId>/select-wireframe" \
  -H "Content-Type: application/json" \
  -d '{ "wireframeId": "<wireframeId>" }'
```

## Save Editor State
```bash
curl -X PUT "$API/landing-agent/campaigns/<campaignId>/editor-state" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Landing Draft",
    "editorState": { "components": [] },
    "renderedJson": { "html": "<section>...</section>", "css": "section{...}" }
  }'
```

## Publish
```bash
curl -X POST "$API/landing-agent/campaigns/<campaignId>/publish" \
  -H "Content-Type: application/json" \
  -d '{ "requireApproval": false }'
```

## Public Page Fetch
```bash
curl "$API/landing-agent/public/<slug>/page"
```

## Public Lead Submit
```bash
curl -X POST "$API/landing-agent/public/<slug>/lead" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess-123",
    "pageVersion": 2,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "utmSource": "linkedin",
    "utmCampaign": "q3-outbound",
    "website": ""
  }'
```

## Public Event Track
```bash
curl -X POST "$API/landing-agent/public/<slug>/event" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess-123",
    "pageVersion": 2,
    "eventName": "page_view",
    "eventData": { "path": "/p/example" },
    "website": ""
  }'
```
