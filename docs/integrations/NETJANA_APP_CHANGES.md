# NetJana → CraftMyFunnel Intel: Sender + Pull API Changes

This doc is written for an AI agent (or engineer) updating the **NetJana app**.

Goal:
- Keep webhook pushes **small, secure, replay-safe** (non-bloating for CraftMyFunnel).
- Allow **user-initiated** retrieval of the full lead card / signal graph for enterprise/top-tier customers.

CraftMyFunnel receiver assumptions:
- Webhook receiver: `POST /webhooks/netjana-intel` (in CraftMyFunnel `apps/api`)
- Full report pull (CraftMyFunnel → NetJana): `GET /v1/intel/leads/{lead_id}`

---

## 1) Webhook Push (Minimal Payload)

### Endpoint (CraftMyFunnel)
- `POST https://<api-host>/webhooks/netjana-intel`
- Content-Type: `application/json`

### Required headers
- `x-source: netjana-intel`
- `x-api-key: <CRAFTMYFUNNEL_API_KEY>` (CraftMyFunnel-provided key)
- `x-netjana-signature: <hex-hmac>` (required in production)
- `x-netjana-timestamp: <unix-seconds>` (required)
- `x-netjana-nonce: <uuid>` (required)

### Signature scheme (replay-safe)
Compute HMAC SHA-256 hex over:

```
signing_input = `${timestamp}.${nonce}.${rawBody}`
hmac = HMAC_SHA256(secret, signing_input).toHexLower()
```

Where `rawBody` is the exact JSON string transmitted (UTF-8).

### Minimal JSON body
Keep this payload stable and small (matches the shared schema file, but only the essentials):

```json
{
  "event": "LEAD_CARD_READY",
  "source": "NetJana.AI / CraftMyFunnel Intel",
  "timestamp": "2026-04-04T08:42:00Z",
  "lead": {
    "lead_id": "b7e452a1-cf56-4b88-9d22-12a8934520bc",
    "company_name": "Modern Logistics Solutions Ltd",
    "buying_stage": "CONSIDERATION",
    "intent_score": 88,
    "verity_tier": "TIER_1"
  },
  "campaign_id": "camp_logistic_2026"
}
```

Notes:
- Do **not** include verbose text fields (`card_why_now`, `card_what_they_need`, `card_do_this`) in the default push.
- If you want the UI to show a small capsule immediately, you may include **one** short field:
  - `lead.card_why_now` but **max 180 chars** (capsule sized).

### Retry
- Retry on non-2xx up to 3 times (exponential backoff).
- Do not retry 401/403 (auth/signature failures).

---

## 2) Full Lead Card Pull API (User-Initiated)

This is called only after a CraftMyFunnel user explicitly “Unlocks full report”.

### Endpoint (NetJana must implement)
- `GET /v1/intel/leads/{lead_id}`

### Auth
Choose one:
1) `x-api-key: <NETJANA_PULL_API_KEY>` (simple)
2) `Authorization: Bearer <token>` (recommended long-term)

Also allow:
- `x-source: craftmyfunnel`

### Response body (full detail)
Return the full lead card fields that CraftMyFunnel may turn into a report and optional campaign copy:

```json
{
  "lead": {
    "lead_id": "b7e452a1-cf56-4b88-9d22-12a8934520bc",
    "company_name": "Modern Logistics Solutions Ltd",
    "geo_state": "Maharashtra",
    "sector": "Logistics & Supply Chain",
    "source_id": "indiamart",
    "buying_stage": "CONSIDERATION",
    "procurement_category": "Warehouse Management Software",
    "intent_score": 88,
    "verity_tier": "TIER_1",
    "is_triangulated": true,
    "card_why_now": "...full text...",
    "card_what_they_need": "...full text...",
    "card_do_this": "...full text...",
    "created_at": "2026-04-04T08:40:15Z"
  },
  "graph": {
    "nodes": [],
    "edges": []
  }
}
```

Graph is optional. If omitted, CraftMyFunnel will still use the lead card text.

### Security + abuse controls
- Rate limit by API key / tenant.
- Return 404 for unknown lead ids.
- Return 403 on invalid key.
- Log `lead_id`, caller identity, and request id for audit.

---

## 3) Size / Storage philosophy (why this design)

- Minimal push keeps bandwidth low and prevents long-term CraftMyFunnel DB bloat.
- Full report is pulled only when a user decides a signal is worth pursuing (paid tiers).
- Replay protection prevents an attacker (or misconfigured retries) from spamming duplicates.

