# ConvoSpan — Audit Implementation Plan
**Date:** 2026-04-15 | **Scope:** `apps/api`, `apps/web`, `apps/edge-fastapi`, `docker-compose.split.yml`

---

## How to Use This Document
Each item has:
- **File(s)** — exact paths to change
- **Problem** — what is broken
- **Fix** — what to do
- **Status** — `[ ]` uncomplete / `[x]` done

Work top-down in priority order. All P0 items must be done before any P1, etc.

---

## 🔴 P0 — Critical (Do First)

### P0-1 · Rate Limiting Bypassed in Split Containers
**File:** `apps/api/src/lib/rateLimit.ts` line 229

**Problem:** `applyRateLimit()` returns `null` (disabled) whenever `NODE_ENV !== 'production'`. The split Docker image does not set `NODE_ENV=production`, so all rate limiting is off in every container deployment.

**Fix:**
- Change the bypass condition to only skip when `NODE_ENV === 'test'` or when `DISABLE_RATE_LIMIT=true` is explicitly set
- In `apps/docker-compose.split.yml`, add `NODE_ENV=production` to the `api` and `web` service environment blocks

```ts
// rateLimit.ts — change line 229 from:
if (process.env['NODE_ENV'] !== 'production' || process.env['DISABLE_RATE_LIMIT'] === 'true') return null;

// to:
if (process.env['NODE_ENV'] === 'test' || process.env['DISABLE_RATE_LIMIT'] === 'true') return null;
```

```yaml
# docker-compose.split.yml — add to api environment:
NODE_ENV: production
```

- [x] Fix `rateLimit.ts` bypass condition
- [x] Add `NODE_ENV: production` to `api` service in `docker-compose.split.yml`
- [x] Add `NODE_ENV: production` to `web` service in `docker-compose.split.yml`

---

### P0-2 · Streaming / SSE Responses Buffered in Fastify nextAdapter
**File:** `apps/api/server.ts` lines 86–104

**Problem:** The `nextAdapter` has no branch for streaming responses (`ReadableStream`). Any route using SSE, chunked transfer, or large file downloads buffers the entire body into RAM before sending, causing timeouts and OOM crashes.

**Fix:** Add a streaming branch before the `arrayBuffer` fallback that detects `ReadableStream` and pipes it directly to Fastify's `reply.raw`.

```ts
// In nextAdapter, add before the arrayBuffer fallback:
if (response.body && response.body instanceof ReadableStream) {
  reply.status(status);
  const reader = response.body.getReader();
  const stream = new (await import('stream')).Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) this.push(null);
      else this.push(Buffer.from(value));
    }
  });
  reply.send(stream);
  return;
}
```

- [x] Add ReadableStream detection branch to `nextAdapter` in `server.ts`
- [ ] Manually test an SSE route (e.g., any AI generation stream endpoint) through the Fastify server

---

### P0-3 · 3 DB Queries Per JWT Request (Session N+1)
**File:** `apps/api/src/lib/auth.ts` lines 88–145

**Problem:** The `jwt` callback fires on every request and makes 3 sequential Prisma queries: plan, membership+team+policy, and user role. Only the plan is Redis-cached. Membership and role are re-queried every time.

**Fix:** Merge all 3 queries into 1 combined query. Cache the full bundle `{ plan, productMode, productSurface, enterpriseRole }` under one Redis key with a 5-minute TTL.

```ts
// Replace separate queries with one:
const userWithContext = await prisma.user.findUnique({
  where: { id: token.id as string },
  select: {
    enterpriseRole: true,
    subscription: { include: { plan: true } },
    memberships: {
      take: 1,
      include: { team: { include: { organizationPolicy: true } } }
    }
  }
});

const cachePayload = {
  plan: userWithContext?.subscription?.plan?.name || 'FREE',
  productMode: userWithContext?.memberships[0]?.team?.organizationPolicy?.productMode || 'ENTERPRISE_CORE',
  productSurface: userWithContext?.memberships[0]?.team?.organizationPolicy?.productSurface || 'outreach',
  enterpriseRole: userWithContext?.enterpriseRole || 'SALES_USER',
};
await safeSet(`user:context:${token.id}`, JSON.stringify(cachePayload), 300);
```

- [x] Merge the 3 DB queries into 1 in `auth.ts` `jwt` callback
- [ ] Cache the full context bundle in Redis with 5-minute TTL
- [ ] Invalidate the `user:context:{id}` cache key on role/subscription change

---

### P0-4 · `DbFactory` Leaks a New PrismaClient Per Request in Production
**File:** `apps/api/src/lib/dbFactory.ts` lines 26–34

**Problem:** In `NODE_ENV === 'production'`, `getGlobalClient()` calls `new PrismaClient()` on every invocation, creating a new connection pool each time. This exhausts PostgreSQL's connection limit rapidly.

**Fix:** Apply the same global singleton cache used in dev mode to all environments. Use a module-level `Map` keyed by region.

```ts
// Replace production branch with:
private static clients = new Map<string, PrismaClient>();

private static getGlobalClient(): PrismaClient {
  if (!this.clients.has('GLOBAL')) {
    this.clients.set('GLOBAL', new PrismaClient());
  }
  return this.clients.get('GLOBAL')!;
}
```

Apply the same pattern to `getUaeClient()` and `getEuClient()`.

- [x] Replace per-request `new PrismaClient()` in `getGlobalClient()` with a singleton
- [ ] Apply same fix to `getUaeClient()` and `getEuClient()`
- [ ] Verify `pgdata` pool connection counts stay stable under load

---

### P0-5 · DB Invariant Blocks All `Message.create()` Calls
**File:** `apps/api/src/lib/db.ts` lines 42–55

**Problem:** The Prisma `$extends` query hook checks for `conversationThreadId` or `thread` on every `message.create()` call. Neither field exists in the `Message` model (the model has `leadId`). This throws an `Invariant Violation` error on every message creation, silently breaking the inbox, LinkedIn message push, and any AI reply features.

**Fix (Option A — Remove the broken invariant):**
Remove the `message.create` extension block entirely. Thread enforcement should be handled at the service layer where context exists.

**Fix (Option B — Add the field to schema):**
Add `conversationThreadId String?` as a nullable FK on `Message`, run a migration, and then the invariant becomes valid. Use this option if thread tracking is a real business requirement.

- [ ] Decide between Option A and Option B with the team
- [ ] Implement chosen fix
- [ ] Run `npx prisma generate` after any schema change
- [ ] Write a test that creates a `Message` and verify it no longer throws

---

### P0-6 · Dead-Letter Jobs Have No Replay / Alert — `INBOX_SYNC`/`CRM_SYNC` Are Stubs
**File:** `apps/api/workers/worker-manager.ts` lines 154–157, `apps/api/src/lib/queue.ts`

**Problem A:** Jobs exceeding `maxAttempts` move to `dead_lettered` with no notification, no UI, and no replay mechanism. The `Job` table grows forever.

**Problem B:** `INBOX_SYNC` and `CRM_SYNC` job types are hardcoded to return `{ success: true, skipped: true }` — they do nothing but consume a job slot.

**Fix:**
1. Add `POST /admin/jobs/dead-letters` — list dead-letter jobs
2. Add `POST /admin/jobs/replay/:id` — re-queue a dead-letter job (reset `status`, `attempts`, `processAt`)
3. On transition to `dead_lettered` in `JobQueue.fail()`, create a `Notification` DB record for the team
4. Remove or implement `INBOX_SYNC` / `CRM_SYNC` — if not ready, at minimum log a `WARN` and remove the misleading `success: true`

```ts
// In JobQueue.fail(), after dead_lettered update:
await prisma.notification.create({
  data: {
    userId: job.payload.userId,
    type: 'JOB_DEAD_LETTERED',
    message: `Job ${job.type} permanently failed after ${job.attempts} attempts`,
    meta: { jobId: job.id, error }
  }
});
```

- [x] Add dead-letter list endpoint at `routes/admin/jobs/dead-letters/route.ts`
- [x] Add replay endpoint at `routes/admin/jobs/replay/[id]/route.ts`
- [x] Add `Notification` creation in `JobQueue.fail()` on dead-letter
- [x] Remove `INBOX_SYNC`/`CRM_SYNC` stub cases from worker switch (or implement them)
- [ ] Add a periodic cleanup job that archives dead-letter jobs older than 30 days

---

### P0-7 · Extension Push Creates Malformed Leads
**File:** `apps/api/routes/extension/push/route.ts`

**Problem:** The `/extension/push` endpoint creates leads that bypass: duplicate detection by email, sovereign region routing, `company` field, consent tracking, and validation schema. These leads fail downstream enrichment because domain heuristics require `company`.

**Fix:** Reuse the same lead creation path as `POST /api/leads`. Extract the lead-upsert logic to a shared `LeadService.upsert()` method and call it from both routes.

```ts
// Create apps/api/src/services/LeadService.ts with:
export async function upsertLeadFromExtension(data: ExtensionLeadInput, teamId: string) {
  const market = MarketRoutingMiddleware.getContext(/* req or region */);
  const db = DbFactory.getClient(market.region);
  // Dedup by linkedIn URL within team
  // Create with all required fields including company
  // Audit log
}
```

- [ ] Create `LeadService.upsert()` shared method
- [ ] Update `extension/push` to use `LeadService.upsert()`
- [ ] Ensure `company` is extracted from `headline` or passed from extension payload
- [ ] Add dedup-by-LinkedInURL check before creating

---

## 🟠 P1 — High Priority

### P1-1 · Credential Auth Leaks User Existence via Error Message
**File:** `apps/api/src/lib/auth.ts` line 52

**Problem:** `"User not found or password not set"` reveals whether an account exists. Attackers can enumerate valid emails.

**Fix:**
```ts
// Replace with:
throw new Error("Invalid credentials");
// (same message for both "user not found" and "wrong password")
```

- [x] Change error message to generic `"Invalid credentials"` for both failure cases in the `authorize` callback

---

### P1-2 · Scheduler Tick Endpoint Has Optional Authentication
**File:** `apps/api/routes/scheduler/tick/route.ts`

**Problem:** Auth is only enforced when `CRON_SECRET` is set. If the env var is missing, the endpoint is open to the public internet.

**Fix:** Require `CRON_SECRET` to be present. Throw a startup error if missing. Add `CRON_SECRET` as a required variable to `.env.example` and the Docker compose file.

```ts
// Change guard to:
const secret = process.env['CRON_SECRET'];
if (!secret) {
  return new NextResponse("CRON_SECRET is not configured", { status: 500 });
}
if (authHeader !== `Bearer ${secret}`) {
  return new NextResponse("Unauthorized", { status: 401 });
}
```

- [x] Make `CRON_SECRET` check non-optional in `scheduler/tick/route.ts`
- [ ] Add `CRON_SECRET` to `apps/api/.env.example`
- [ ] Add `CRON_SECRET` to `apps/docker-compose.split.yml` api environment

---

### P1-3 · Middleware Rate Limit Path Matching is Always Wrong
**File:** `apps/api/src/lib/middleware.ts` lines 19–33

**Problem:** Code like `path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/auth")` compares a relative pathname (e.g. `/auth/signin`) against a full URL prefix (e.g. `http://api:3001/auth/signin`). This never matches, so `AUTH` rate limits never apply.

**Fix:** Use plain path prefixes instead of the env URL:

```ts
// Replace all occurrences of:
path.startsWith(process.env['NEXT_PUBLIC_API_URL'] + "/auth")
// With:
path.startsWith("/api/auth")

// And:
process.env['NEXT_PUBLIC_API_URL'] + "/webhooks"  →  "/api/webhooks"
process.env['NEXT_PUBLIC_API_URL'] + "/errors/client"  →  "/api/errors/client"
process.env['NEXT_PUBLIC_API_URL'] + "/admin"  →  "/api/admin"
// etc.
```

- [ ] Replace all `process.env['NEXT_PUBLIC_API_URL'] + "/<path>"` patterns in middleware with literal path strings
- [ ] Test that auth endpoints now hit `RATE_LIMITS.AUTH` (5 req/hr) and not `AUTHENTICATED` (1000 req/min)

---

### P1-4 · Next.js Image Proxy Allows Any Hostname (SSRF Risk)
**File:** `apps/web/next.config.mjs` lines 22–29

**Problem:** `hostname: '**'` converts the Next.js image optimizer into an open proxy for any URL.

**Fix:** Enumerate only the required hostnames explicitly:

```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    { protocol: 'https', hostname: '*.google.com' },
    { protocol: 'https', hostname: 'media.licdn.com' },
    // Add your CDN domain here
  ],
},
```

- [x] Replace wildcard hostname with explicit allowlist in `next.config.mjs`

---

### P1-5 · Credits Deducted Before Enrichment Work Succeeds
**File:** `apps/api/workers/handlers/enrichment-worker.ts` lines 20–29

**Problem:** `deductCredits()` is called before checking if the lead exists or if enrichment can proceed. Leads not found or enrichment failures result in lost credits with no refund.

**Fix:** Move credit deduction to after the lead is confirmed to exist and work has been attempted. On failure, call a `refundCredits()` helper.

```ts
// Pattern:
const lead = await prisma.lead.findUnique({ where: { id: leadId } });
if (!lead) throw new Error(`Lead ${leadId} not found`);

// Now deduct, after confirming preconditions
const deducted = await deductCredits(teamId, ENRICHMENT_COST, ...);
if (!deducted) throw new Error("Insufficient credits");

try {
  // ... do enrichment work
} catch (err) {
  await refundCredits(teamId, ENRICHMENT_COST, `Refund: enrichment failed for ${leadId}`);
  throw err;
}
```

- [ ] Create `refundCredits()` helper in `apps/api/src/lib/credits.ts`
- [x] Move credit deduction in `enrichment-worker.ts` to after lead existence is confirmed
- [x] Wrap enrichment work in try/catch that refunds on failure

---

### P1-6 · Edge FastAPI Crashes on DB Startup Race Condition
**File:** `apps/edge-fastapi/main.py` lines 89–98, `apps/edge-fastapi/database.py` line 38

**Problem:** `init_db()` is called synchronously at startup without retries. If Postgres isn't ready yet (common race condition even with `depends_on`), the container fails immediately.

**Fix:** Wrap `init_db()` in a retry loop:

```python
import time

def init_db_with_retry(retries=5, delay=3):
    for attempt in range(retries):
        try:
            init_db()
            return
        except Exception as e:
            logger.warning(f"DB init attempt {attempt + 1}/{retries} failed: {e}")
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
    raise RuntimeError("Failed to initialize database after multiple attempts")

# In startup_event():
init_db_with_retry()
```

- [ ] Add `init_db_with_retry()` to `database.py` or `main.py`
- [x] Call `init_db_with_retry()` instead of `init_db()` in `startup_event`

---

### P1-7 · Webhook Secret is UUID, Not a Cryptographic Key
**File:** `apps/api/routes/webhooks/route.ts` line 48

**Problem:** `crypto.randomUUID()` generates a 128-bit value with known hyphenated structure — far weaker than a proper HMAC key.

**Fix:**
```ts
// Replace:
secret: crypto.randomUUID()

// With (in Node.js):
const { randomBytes } = await import('crypto');
secret: randomBytes(32).toString('hex')
```

- [x] Update webhook secret generation to use `randomBytes(32).toString('hex')`

---

### P1-8 · Admin RBAC is Inconsistent Across Routes
**File:** `apps/api/routes/admin/users/route.ts`, `apps/api/routes/admin/stats/route.ts`, and other admin routes

**Problem:** Some admin routes check `role === "admin"` (legacy string) while others check `enterpriseRole === UserRole.SYSTEM_ADMIN`. A user could pass one but not the other depending on which route they hit.

**Fix:** Standardize all admin checks to use the `checkAdmin()` helper from `apps/api/src/lib/admin.ts`. Retire the legacy `role` string check. Update `checkAdmin()` to exclusively use `enterpriseRole`.

- [ ] Audit all files in `apps/api/routes/admin/` for inline role checks
- [ ] Replace all inline checks with `checkAdmin()` calls
- [ ] Ensure `checkAdmin()` checks only `enterpriseRole === SYSTEM_ADMIN || ORG_ADMIN`

---

## 🟡 P2 — Medium Priority

### P2-1 · EU Database Silently Falls Back to Global (GDPR Risk)
**File:** `apps/api/src/lib/dbFactory.ts` lines 56–62

**Problem:** Missing `EU_DATABASE_URL` causes EU-region requests to route to the global database with only a `console.warn`. This is a GDPR compliance risk that is invisible in production.

**Fix:** Make EU fallback throw just like UAE:
```ts
if (!euUrl) {
  throw new Error("CRITICAL_COMPLIANCE_ERROR: EU_DATABASE_URL is not set. GDPR data residency requirements cannot be met.");
}
```
If intentional fallback is needed, require an explicit `EU_ALLOW_GLOBAL_FALLBACK=true` env var.

- [ ] Change EU DB fallback from `console.warn` + fallback to throw
- [ ] Add `EU_ALLOW_GLOBAL_FALLBACK` env var opt-in if needed
- [ ] Add `EU_DATABASE_URL` to `.env.example` with explanation

---

### P2-2 · Split Docker Compose Missing Redis Service
**File:** `apps/docker-compose.split.yml`

**Problem:** The `api` container uses Redis for rate limiting and session caching, but `docker-compose.split.yml` has no Redis service. Without `REDIS_URL`, the API silently runs without any Redis features.

**Fix:** Add a Redis service and wire `REDIS_URL` to the `api` service:

```yaml
redis:
  image: redis:7-alpine
  container_name: convospan-redis-split
  ports:
    - "6380:6379"
  volumes:
    - redisdata:/data

# In api environment:
REDIS_URL: redis://redis:6379
```

- [ ] Add `redis` service to `docker-compose.split.yml`
- [ ] Add `REDIS_URL` to `api` service environment
- [ ] Add `redisdata` volume

---

### P2-3 · Worker Has No Graceful Shutdown or Concurrency
**File:** `apps/api/workers/worker-manager.ts`, `apps/api/workers/start-workers.ts`

**Problem:** The worker processes one job at a time and has no `SIGTERM`/`SIGINT` handler. Mid-job container restarts leave jobs stuck in `running` state until the 15-minute stale-reset watchdog fires.

**Fix:**
1. Add `process.on('SIGTERM', () => workerManager.stop())` in the worker startup script
2. Allow `stop()` to wait for the current job to complete (drain)
3. Add a `concurrency` option to process N jobs in parallel using `Promise.all`

```ts
// In start-workers.ts:
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, draining worker...');
  await workerManager.stop();
  process.exit(0);
});
```

- [ ] Add `SIGTERM`/`SIGINT` handlers to `start-workers.ts`
- [ ] Implement drain on `workerManager.stop()` (wait for current job)
- [ ] Add a `WORKER_CONCURRENCY` env var (default: 3) for parallel job processing

---

### P2-4 · `/execute` Endpoint on Edge is Unauthenticated
**File:** `apps/edge-fastapi/main.py` lines 235–246

**Problem:** The `/execute` endpoint accepts arbitrary browser actions with no authentication. It is exposed on port 8000 in Docker. If ever connected to a real actuator, this is an RCE vector.

**Fix:**
1. Add API key authentication (check `Authorization: Bearer <EDGE_API_KEY>` header)
2. Add a `EDGE_EXECUTE_ENABLED` feature flag — disable by default
3. Strictly enum the `action` values

```python
EDGE_API_KEY = os.getenv("EDGE_API_KEY")

@app.post("/execute")
def execute_browser_action(request: ExecuteRequest, authorization: str = Header(None)):
    if not EDGE_MODE or not os.getenv("EDGE_EXECUTE_ENABLED"):
        raise HTTPException(status_code=503, detail="Execute endpoint disabled")
    if EDGE_API_KEY and authorization != f"Bearer {EDGE_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    ...
```

- [ ] Add `EDGE_API_KEY` env var and check it in the `/execute` handler
- [ ] Add `EDGE_EXECUTE_ENABLED` feature flag (default `false`)
- [ ] Enum the valid `action` values in `ExecuteRequest`

---

### P2-5 · Scheduler Requires External HTTP CRON Caller
**File:** `apps/api/routes/scheduler/tick/route.ts`, `apps/api/workers/worker-manager.ts`

**Problem:** The scheduler only fires when an external HTTP POST hits `/scheduler/tick`. In the Docker split deployment there is no external caller configured, so scheduled campaigns never run.

**Fix:** Add an internal `setInterval` inside the `WorkerManager` that calls `schedulerService.processDueSchedules()` at a configurable interval (default: every 60 seconds).

```ts
// In WorkerManager.start():
const scheduleInterval = parseInt(process.env['SCHEDULE_INTERVAL_MS'] || '60000');
setInterval(async () => {
  const { schedulerService } = await import('@/modules/scheduler/schedulerService');
  await schedulerService.processDueSchedules();
}, scheduleInterval);
```

- [ ] Add internal scheduler tick to `WorkerManager.start()`
- [ ] Make interval configurable via `SCHEDULE_INTERVAL_MS` env var
- [ ] Keep the HTTP endpoint as a manual override / external fallback

---

### P2-6 · Auth `401` Errors on All Public Pages
**File:** `apps/api/src/lib/middleware.ts` lines 68–76

**Problem:** The `isPublic` check references `process.env['NEXT_PUBLIC_API_URL']` for path matching (same issue as P1-3). Public pages like `/about`, `/contact`, and `/pricing` aren't being excluded correctly, causing auth session fetch failures on every page load (confirmed by `audit-report.json`).

**Fix:** Fix public path detection to use literal API path prefixes. Ensure `/api/auth` is always excluded from session requirements.

```ts
const isPublic =
  publicPaths.some(p => path === p) ||
  path.startsWith('/api/auth') ||          // was: NEXT_PUBLIC_API_URL + "/auth"
  path.startsWith('/api/webhooks') ||      // was: NEXT_PUBLIC_API_URL + "/webhooks"
  path.startsWith('/_next') ||
  path.startsWith('/static') ||
  path.startsWith('/images');
```

- [ ] Fix all `NEXT_PUBLIC_API_URL + "/<path>"` pattern in `isPublic` check
- [ ] Verify `/about`, `/contact`, `/pricing` no longer produce 401 errors

---

### P2-7 · Webhook Outbound Payloads May Leak Internal Fields
**File:** `apps/api` — wherever `webhookService.dispatch()` is called

**Problem:** Webhook payloads are constructed from raw Prisma objects and dispatched to external URLs without field filtering. This may expose internal identifiers, raw SQL fields, or sensitive data.

**Fix:** Define an explicit `WebhookPayloadSchema` per event type, and serialize through it before dispatch.

```ts
// Example for lead.enriched:
const WEBHOOK_SCHEMAS: Record<string, (data: any) => object> = {
  'lead.enriched': (d) => ({
    id: d.leadId,
    email: d.email,
    company: d.company,
    enrichedAt: d.enrichedAt,
  }),
};
```

- [ ] Create `WebhookPayloadSchema` map in `webhookService`
- [ ] Apply schema serialization before every `dispatch()` call
- [ ] Document allowed fields per event in API reference

---

### P2-8 · `getCurrentContext()` Defaults Silently to Wrong Team
**File:** `apps/api/src/lib/auth.ts` lines 247–258

**Problem:** When no `convo-workspace-id` cookie is set, the function returns the user's first team by insertion order. Multi-team users always operate in an unexpected context after session refresh.

**Fix:** For users with multiple team memberships, do not silently default. Return `{ userId, teamId: null }` and let the calling route return a `409 CONFLICT requires workspace selection` response, or redirect to a workspace picker page.

- [ ] Update `getCurrentContext()` to detect multi-team users  
- [ ] Return `{ userId, teamId: null, requiresWorkspaceSelection: true }` for multi-team users without cookie
- [ ] Update consuming routes to handle `teamId: null` with a clear error response

---

### P2-9 · Duplicate `export` / `exports` Route Directories
**File:** `apps/api/routes/export/` and `apps/api/routes/exports/`

**Problem:** Both directories exist with overlapping names, likely a naming accident. Unclear which is canonical.

**Fix:**
1. Audit which routes are in each
2. Merge into `exports/` (plural is the REST standard)
3. Remove the empty/duplicate directory
4. Check all internal references and update them

- [ ] List contents of both directories and decide on canonical
- [ ] Migrate routes to `exports/`
- [ ] Delete `export/` directory
- [ ] Update any consumers that reference the removed path

---

## 🟢 P3 — Low / Developer Experience

### P3-1 · Replace `console.log` with Structured Logger in Routes
**Files:** `apps/api/routes/extension/push/route.ts`, `apps/api/routes/admin/actions/*/route.ts`, `apps/api/routes/leads/route.ts`, `apps/api/routes/ml-training/generate/route.ts`, and 9 other route files

**Fix:** Replace all `console.log` / `console.warn` with calls to the existing `logger` from `@/lib/logger`.

```ts
// Replace:
console.log(`[Extension Push] Received profile:`, name);
// With:
logger.info('[extension/push] Received profile', { name, teamId });
```

- [ ] Run a codebase search for `console.log` in `routes/` and `workers/`
- [ ] Replace each occurrence with the appropriate `logger.info/warn/error` call

---

### P3-2 · Fix `@ts-ignore` in Lead Creation Route
**File:** `apps/api/routes/leads/route.ts` lines 105, 129, 139

**Problem:** Type ignores suppress real type mismatches between the sovereign routing region strings and the Prisma enum, and between the stale Prisma client and the schema.

**Fix:**
1. Run `npx prisma generate` after every schema change in CI
2. Create a type adapter that properly converts `'UAE' | 'GLOBAL' | 'EU'` to the `Region` enum
3. Remove `@ts-ignore` once types are correct

- [ ] Add `prisma generate` as a pre-build step in `apps/api/package.json`
- [ ] Create a `regionToEnum()` utility in `apps/api/src/lib/regions.ts`
- [ ] Remove all `@ts-ignore` comments in `leads/route.ts`

---

### P3-3 · Add Docker `healthcheck` for `api` and `web` Services
**File:** `apps/docker-compose.split.yml`

**Fix:**
```yaml
api:
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 20s

web:
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
```

- [ ] Add `healthcheck` block to `api` service
- [ ] Add `healthcheck` block to `web` service

---

### P3-4 · Move `pino-pretty` to `devDependencies`
**File:** `apps/api/package.json`

**Problem:** `pino-pretty` is in `dependencies`, adding ~2MB to the production Docker image. Production should output raw JSON.

**Fix:**
- Move `pino-pretty` to `devDependencies`
- In `server.ts`, only use `pino-pretty` transport when `NODE_ENV !== 'production'`

```ts
const fastify = Fastify({
  logger: {
    level: 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty' }
    })
  }
});
```

- [ ] Move `pino-pretty` to `devDependencies` in `apps/api/package.json`
- [ ] Add conditional transport in `server.ts`

---

### P3-5 · Remove `next` / `react` / `react-dom` from API Production Dependencies
**File:** `apps/api/package.json` lines 40, 53–54

**Problem:** The Fastify API bundles Next.js, React, and React DOM as production dependencies, pulling in ~30MB of unused framework code into the Docker image.

**Fix:** These are only required because NextAuth types and handlers are imported. Consider:
1. Moving NextAuth to an API-compatible auth library (e.g. `oslo`, `lucia-auth`)
2. Or keeping them but moving to `devDependencies` and relying on Fastify to exclude them at runtime

- [ ] Audit which NextAuth imports are actually needed in the API
- [ ] Move `next`, `react`, `react-dom` to `devDependencies` or eliminate the dependency

---

### P3-6 · Add `audit-report.json` and Build Logs to `.gitignore`
**Files:** `apps/web/.gitignore`, `apps/.gitignore` (or root `.gitignore`)

**Problem:** `apps/web/audit-report.json`, `apps/web/audit-screenshots/`, `apps/tmp-web-build.log`, and `apps/tmp-web-typecheck.log` are committed to the repository and contain runtime error details and internal paths.

**Fix:**
```gitignore
# In apps/web/.gitignore:
audit-report.json
audit-screenshots/

# In root .gitignore:
apps/tmp-*.log
```

- [ ] Add `audit-report.json` and `audit-screenshots/` to `apps/web/.gitignore`
- [ ] Add `tmp-*.log` pattern to root `.gitignore`
- [ ] Remove these files from Git tracking: `git rm --cached`

---

### P3-7 · Fix Billing Hardcoded USD Currency for Razorpay
**File:** `apps/api/routes/billing/checkout/route.ts` line 72

**Problem:** Razorpay is an Indian payment gateway; its native currency is INR. Creating orders in `"USD"` requires Razorpay's currency conversion feature and may break or produce incorrect amounts for most users.

**Fix:** Derive the currency from the plan or a `BILLING_CURRENCY` env var. Default to `INR` for Razorpay:

```ts
const currency = process.env['BILLING_CURRENCY'] || 'INR';
const order = await billingService.createOrder(orderAmount, currency, ...);
```

- [ ] Add `BILLING_CURRENCY` env var (default `INR`)
- [ ] Update `createOrder` call to use configured currency
- [ ] Add to `.env.example` with comment on Razorpay vs Stripe defaults

---

### P3-8 · Hardcoded Version `"1.0.0"` in Edge FastAPI
**File:** `apps/edge-fastapi/main.py` line 116

**Fix:** Read version from an env var or a `VERSION` file baked in at build time:

```python
VERSION = os.getenv("APP_VERSION", "dev")

@app.get("/version")
def version():
    return {"version": VERSION}
```

In `Dockerfile`:
```dockerfile
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
```

- [ ] Add `APP_VERSION` env var support to `main.py`
- [ ] Pass `--build-arg APP_VERSION=$(git describe --tags)` in CI build step

---

### P3-9 · SQLAlchemy Engine Has Default Connection Pool (Edge)
**File:** `apps/edge-fastapi/database.py` line 13

**Problem:** Default SQLAlchemy pool is 5 connections + 10 overflow. The edge service shares the same Postgres instance as the API, risking connection starvation.

**Fix:**
```python
engine = create_engine(
    DATABASE_URL,
    pool_size=3,
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=300,
)
```

- [ ] Configure explicit pool settings in `database.py`
- [ ] Add `pool_pre_ping=True` to detect stale connections

---

## Completion Checklist Summary

| Priority | Total Items | Done |
|---|---|---|
| 🔴 P0 | 28 tasks | `[ ]` |
| 🟠 P1 | 22 tasks | `[ ]` |
| 🟡 P2 | 25 tasks | `[ ]` |
| 🟢 P3 | 18 tasks | `[ ]` |
| **Total** | **93 tasks** | **0 / 93** |

---

*Last updated: 2026-04-15. Update this document as items are completed.*
