# Prompts for Gemini (NetJana.AI) — Implement Secure, Optimized Intel Data Flow

Use this file as a copy/paste prompt set for Gemini to update the **NetJana** codebase.

Target outcome:
- Default delivery is **minimal**, **secure**, **replay-safe**, and **non-bloating**.
- Full long-form intel is **pulled only after user action** (enterprise/top-tier feature).

ConvoSpan already implements:
- Webhook receiver: `POST /webhooks/netjana-intel` (ConvoSpan `apps/api`)
- User-initiated pull: ConvoSpan calls `GET {NETJANA_URL}/v1/intel/leads/{lead_id}` (NetJana must add)

Do **not** change ConvoSpan paths above unless explicitly told.

---

## Prompt 0 — Context + Constraints (paste first)

You are working on the NetJana.AI (Intel Engine) codebase.

Constraints:
- Keep default webhook payload small (no verbose long-form fields in the push by default).
- Add strong security: API key auth + HMAC signature over raw bytes + timestamp + nonce replay protection.
- Add a pull endpoint that returns full lead card details (and optionally graph).
- Avoid data bloat and avoid breaking backwards compatibility.

Acceptance criteria:
1) NetJana can push minimal signals to ConvoSpan successfully.
2) ConvoSpan can request full details for a `lead_id` via pull API after a user clicks “Unlock full report”.
3) Replay protection blocks repeated identical requests with same nonce in TTL.
4) HMAC verification fails closed in production (missing/invalid signature -> 401/403).

---

## Prompt 1 — Implement minimal webhook push (secure + replay-safe)

Implement a webhook client in NetJana that POSTs to:
`https://<CONVOSPAN_API_HOST>/webhooks/netjana-intel`

Headers required on every request:
- `Content-Type: application/json`
- `x-source: netjana-intel`
- `x-api-key: <CONVOSPAN_API_KEY>`
- `x-netjana-timestamp: <unix-seconds>`
- `x-netjana-nonce: <uuid>`
- `x-netjana-signature: <hex>` computed as:

```
rawBody = JSON.stringify(payload)  // do not reformat after signing
signing_input = `${timestamp}.${nonce}.${rawBody}`
signature = HMAC_SHA256(NETJANA_HMAC_SECRET, signing_input).hexLower()
```

Timestamp rules:
- Use current Unix seconds.
- Receiver will reject timestamps outside ±300 seconds window (assume).

Nonce rules:
- Generate a UUID v4 for each request.

Payload rules (minimal):
- MUST match:
  - `event` one of: `LEAD_CARD_READY`, `SIGNAL_INGESTED`, `INTENT_UPDATED`
  - `source` exactly: `NetJana.AI / ConvoSpan Intel`
  - `timestamp` ISO-8601 string
  - `lead` object includes:
    - `lead_id` (uuid)
    - `company_name` (string)
    - `intent_score` (int 0..100)
    - optional: `buying_stage` enum `AWARENESS|CONSIDERATION|DECISION|UNKNOWN`
    - optional: `verity_tier` enum `TIER_1|TIER_2`
  - optional: `campaign_id`

Do NOT include these fields in the default push:
- `card_why_now`, `card_what_they_need`, `card_do_this`
- graph nodes/edges

Optional optimization:
- Support `Content-Encoding: gzip` when pushing large batches. Keep it off by default unless easy.

Implementation notes:
- Ensure the HMAC is computed over the exact rawBody that is transmitted (UTF-8).
- Do not sign parsed objects; sign the serialized JSON string.

Deliverables:
- Code implementing the push client
- Configuration/env variables:
  - `CONVOSPAN_WEBHOOK_URL`
  - `CONVOSPAN_API_KEY`
  - `NETJANA_HMAC_SECRET`

---

## Prompt 2 — Add replay protection on NetJana’s own webhook sender (optional but recommended)

Even though replay protection is mainly the receiver’s job, add sender-side safety:
- Never reuse nonce values.
- If your queue retries a request, reuse the same nonce+timestamp+signature for that exact retry attempt (so receiver dedupe can be deterministic), OR generate a new nonce per attempt (document which you choose).

Pick one and be consistent.

---

## Prompt 3 — Implement pull API endpoint for full lead card details

Implement in NetJana an authenticated endpoint:

- `GET /v1/intel/leads/{lead_id}`

Auth:
- Require `x-api-key: <NETJANA_PULL_API_KEY>` (start with this)
- Also accept `x-source: convospan`
- Return 403 if key invalid/missing.

Response (JSON):

```json
{
  "lead": {
    "lead_id": "...",
    "company_name": "...",
    "geo_state": "...",
    "sector": "...",
    "source_id": "...",
    "buying_stage": "CONSIDERATION",
    "procurement_category": "...",
    "intent_score": 88,
    "verity_tier": "TIER_1",
    "is_triangulated": true,
    "card_why_now": "long text",
    "card_what_they_need": "long text",
    "card_do_this": "long text",
    "created_at": "ISO-8601"
  },
  "graph": {
    "nodes": [],
    "edges": []
  }
}
```

Graph is optional:
- If you have it, return it.
- If you don’t, return `"graph": null` or omit it.

Deliverables:
- Route + handler
- Storage/query implementation to fetch full lead card by `lead_id`
- Env var: `NETJANA_PULL_API_KEY`

---

## Prompt 4 — Rate limits + logging

Add abuse controls:
- Rate-limit `GET /v1/intel/leads/{lead_id}` by API key (and optionally IP).
- Log: `lead_id`, request id, caller key id/source, response status, latency.

---

## Prompt 5 — Quick tests (must include)

Add minimal tests (or runnable scripts) proving:
1) HMAC signing produces a stable signature for fixed body.
2) Pull endpoint returns expected fields for a known lead id.
3) Auth failure returns 403.

If the codebase has no test framework, provide a script under `scripts/` to:
- generate a signed webhook request
- call the pull endpoint with a sample id

---

## Prompt 6 — Output format for Gemini response

When you finish:
- List files created/changed.
- Provide exact curl examples:
  - webhook push (with signature)
  - pull endpoint call
- Document required env vars.

