# Managed Runtime API (OpenAPI Summary Stub)

This is a documentation stub to align routes and contracts. The authoritative API is implemented in `services/managed-runtime-api/`.

## Base
- Service: Managed Runtime API (FastAPI)
- Base URL: `${MANAGED_RUNTIME_URL}`
- Auth: HMAC signature or API key (see `services/managed-runtime-api/app/core/security.py`)

---

## Health

### `GET /health`
Returns basic liveness status.

### `GET /ready`
Returns readiness status.

### `GET /version`
Returns runtime version info.

### `GET /capabilities`
Returns supported capabilities and models.

---

## Runtime

### `POST /v1/tokenize`
Tokenize or mask PII in payload.

**Request**
```json
{
  "version": "1.0",
  "task_type": "tokenize",
  "tenant_id": "...",
  "execution_mode": "managed_runtime",
  "target_runtime": "managed_runtime",
  "task_id": "...",
  "idempotency_key": "...",
  "created_at": "...",
  "expires_at": "...",
  "payload": {}
}
```

**Response**
```json
{
  "task_id": "...",
  "status": "succeeded",
  "result": {}
}
```

### `POST /v1/generate`
Generate text output based on prompt and policy.

### `POST /v1/classify`
Classify content (reply intent, sentiment, etc.).

### `POST /v1/execute`
Execute a task via runtime (browser, SDK, or model routing).

### `GET /v1/tasks/{id}`
Fetch task state and results.

### `GET /v1/runtime/status`
Fetch runtime health and queue state.

---

## Notes
- All requests should include strict task envelope fields.
- Idempotency is required for mutating actions.
- Execution must reject malformed or incompatible task versions.
