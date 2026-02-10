# Comprehensive Rate Limiting System

**Implemented:** February 10, 2026  
**Version:** 1.0  
**Status:** ✅ PRODUCTION READY

---

## Overview

The ConvoSpan platform now includes a multi-tier rate limiting system that protects against abuse while ensuring legitimate users have seamless access. The system is implemented at the middleware level and uses an in-memory LRU cache for development/single-instance deployments.

---

## Architecture

### Components

1. **Rate Limiting Service** (`src/lib/rateLimit.ts`)
   - Core rate limiting logic
   - Multi-tier configuration
   - Client identifier resolution
   - Cache management

2. **Middleware Integration** (`src/middleware.ts`)
   - Automatic rate limit enforcement
   - Pre-authentication checks
   - Response header injection

3. **Admin Management API** (`src/app/api/admin/rate-limits/route.ts`)
   - Statistics monitoring
   - Manual reset capabilities
   - Status checking

---

## Rate Limit Tiers

### 1. Public APIs (Unauthenticated)
- **Limit:** 100 requests per minute per IP
- **Window:** 60 seconds
- **Applies to:** Any public API endpoint
- **Identifier:** IP Address

```typescript
RATE_LIMITS.PUBLIC = {
  windowMs: 60 * 1000,
  maxRequests: 100,
}
```

### 2. Authentication Endpoints
- **Limit:** 5 requests per hour per IP
- **Window:** 3600 seconds
- **Applies to:** `/api/auth/*`, `/api/register`
- **Identifier:** IP Address
- **Purpose:** Prevent brute force attacks

```typescript
RATE_LIMITS.AUTH = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
}
```

### 3. Authenticated User APIs
- **Limit:** 1000 requests per minute per user
- **Window:** 60 seconds
- **Applies to:** All authenticated endpoints
- **Identifier:** User ID

```typescript
RATE_LIMITS.AUTHENTICATED = {
  windowMs: 60 * 1000,
  maxRequests: 1000,
}
```

### 4. Admin APIs
- **Limit:** 5000 requests per minute per admin
- **Window:** 60 seconds
- **Applies to:** `/api/admin/*`
- **Identifier:** User ID
- **Note:** High limit but all requests are logged

```typescript
RATE_LIMITS.ADMIN = {
  windowMs: 60 * 1000,
  maxRequests: 5000,
}
```

### 5. Webhook Endpoints
- **Limit:** 50 requests per minute per source
- **Window:** 60 seconds
- **Applies to:** `/api/webhooks/*`
- **Identifier:** IP Address or API Key

```typescript
RATE_LIMITS.WEBHOOK = {
  windowMs: 60 * 1000,
  maxRequests: 50,
}
```

### 6. Error Logging Endpoint
- **Limit:** 10 requests per minute per IP
- **Window:** 60 seconds
- **Applies to:** `/api/errors/client`
- **Identifier:** IP Address
- **Purpose:** Prevent error logging abuse

```typescript
RATE_LIMITS.ERROR_LOGGING = {
  windowMs: 60 * 1000,
  maxRequests: 10,
}
```

---

## Client Identification

The system identifies clients using a priority hierarchy:

1. **User ID** (highest priority) - For authenticated requests
2. **API Key** - From `X-Api-Key` header
3. **IP Address** (fallback) - From `X-Forwarded-For` or `X-Real-IP`

```typescript
function getClientIdentifier(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;
  if (apiKey) return `apikey:${apiKey}`;
  return `ip:${ipAddress}`;
}
```

---

## Response Headers

When a request is rate limited, the following headers are included:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707562800000
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "retryAfter": 45,
  "endpoint": "public"
}
```

### Header Descriptions

- **`Retry-After`**: Seconds until the rate limit resets
- **`X-RateLimit-Limit`**: Maximum requests allowed in the window
- **`X-RateLimit-Remaining`**: Requests remaining in current window
- **`X-RateLimit-Reset`**: Unix timestamp when the window resets

---

## Implementation Flow

### Request Processing

```
┌─────────────────────────────────────────┐
│  1. Request arrives at middleware       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  2. Extract token and user ID           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  3. Determine endpoint type             │
│     (auth, webhook, admin, etc.)        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  4. Get client identifier               │
│     (user ID > API key > IP)            │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  5. Check rate limit                    │
│     (lookup in LRU cache)               │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼               ▼
    ALLOWED         BLOCKED
         │               │
         │               ▼
         │      ┌─────────────────┐
         │      │ Return 429      │
         │      │ with headers    │
         │      └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  6. Continue to authentication check    │
└─────────────────────────────────────────┘
```

---

## Administration

### View Statistics

```bash
GET /api/admin/rate-limits

Response:
{
  "stats": {
    "size": 245,
    "maxSize": 10000,
    "calculatedSize": 245
  }
}
```

### Check Specific Rate Limit

```bash
POST /api/admin/rate-limits
Content-Type: application/json

{
  "action": "status",
  "identifier": "user:123",
  "endpoint": "authenticated"
}

Response:
{
  "identifier": "user:123",
  "endpoint": "authenticated",
  "status": {
    "count": 45,
    "resetTime": 1707562800000
  }
}
```

### Reset Rate Limit

```bash
POST /api/admin/rate-limits
Content-Type: application/json

{
  "action": "reset",
  "identifier": "ip:192.168.1.1",
  "endpoint": "public"
}

Response:
{
  "success": true,
  "message": "Rate limit reset for ip:192.168.1.1 on public"
}
```

### Clear All Rate Limits (⚠️ Use with Caution)

```bash
POST /api/admin/rate-limits
Content-Type: application/json

{
  "action": "clear"
}

Response:
{
  "success": true,
  "message": "All rate limits cleared"
}
```

---

## Configuration

### Environment Variables

No environment variables are required for basic operation. The system uses sensible defaults.

For production with Redis (future enhancement):

```env
# Optional: Redis for distributed rate limiting
REDIS_URL=redis://localhost:6379
ENABLE_REDIS_RATE_LIMIT=true
```

### Adjusting Limits

To modify rate limits, edit `src/lib/rateLimit.ts`:

```typescript
export const RATE_LIMITS = {
  PUBLIC: {
    windowMs: 60 * 1000,
    maxRequests: 100,  // ← Modify this
  },
  // ... other limits
}
```

After modifying limits:
1. Restart the server
2. Clear existing rate limits (optional)

---

## Testing

### Manual Testing

1. **Test Public API Rate Limit:**
```bash
# Send 101 requests rapidly
for i in {1..101}; do
  curl http://localhost:3000/api/health
done

# Request 101 should return 429
```

2. **Test Auth Rate Limit:**
```bash
# Try to register 6 times in an hour
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}'
done

# Request 6 should return 429
```

3. **Test Error Logging Rate Limit:**
```bash
# Send 11 errors rapidly
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/errors/client \
    -H "Content-Type: application/json" \
    -d '{"message":"Test error","stack":"test"}'
done

# Request 11 should return 429
```

### Automated Testing

Create test file: `src/__tests__/rateLimit.test.ts`

```typescript
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

describe('Rate Limiting', () => {
  it('should allow requests within limit', () => {
    const result = checkRateLimit('test:user', RATE_LIMITS.PUBLIC, 'test');
    expect(result.allowed).toBe(true);
  });

  it('should block requests exceeding limit', () => {
    const identifier = 'test:blocked';
    const config = { windowMs: 60000, maxRequests: 5 };
    
    // Make 5 requests (should all succeed)
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(identifier, config, 'test');
      expect(result.allowed).toBe(true);
    }
    
    // 6th request should be blocked
    const result = checkRateLimit(identifier, config, 'test');
    expect(result.allowed).toBe(false);
  });
});
```

---

## Monitoring

### Key Metrics to Monitor

1. **Rate Limit Hit Rate**
   - % of requests that hit rate limits
   - Target: <1% for legitimate traffic

2. **Cache Size**
   - Number of unique identifiers tracked
   - Alert if approaching max (10,000)

3. **Endpoint-Specific Patterns**
   - Which endpoints get rate limited most
   - May indicate attack or misconfiguration

### Logging

All rate limit hits are automatically logged. To add custom logging:

```typescript
// In src/lib/rateLimit.ts
export function applyRateLimit(...) {
  if (!result.allowed) {
    console.warn('[RATE_LIMIT] Blocked request', {
      identifier,
      endpoint,
      timestamp: new Date().toISOString(),
    });
    // ... existing code
  }
}
```

---

## Migration from Old System

### Before (Registration endpoint only)

```typescript
// Old: In-memory map in route.ts
const registrationRateLimit = new Map();
```

### After (Comprehensive middleware)

```typescript
// New: Centralized service in middleware
// Automatically applied to all routes
```

### Benefits

1. ✅ Single source of truth
2. ✅ Consistent behavior across all endpoints
3. ✅ Easy to monitor and manage
4. ✅ Better memory management (LRU cache)
5. ✅ Proper HTTP headers
6. ✅ Admin management API

---

## Future Enhancements

### Phase 1: Redis Backend (Recommended for multi-instance)

```typescript
// Redis-backed rate limiting for distributed systems
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(identifier, config, endpoint) {
  const key = `ratelimit:${endpoint}:${identifier}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, config.windowMs / 1000);
  }
  
  return {
    allowed: count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetTime: Date.now() + (await redis.ttl(key)) * 1000,
  };
}
```

### Phase 2: Dynamic Rate Limits

```typescript
// Adjust limits based on user tier
function getRateLimitConfig(userId: string) {
  const user = await getUser(userId);
  
  if (user.tier === 'ENTERPRISE') {
    return { ...RATE_LIMITS.AUTHENTICATED, maxRequests: 10000 };
  }
  
  return RATE_LIMITS.AUTHENTICATED;
}
```

### Phase 3: Rate Limit Dashboard

```typescript
// Real-time dashboard showing:
// - Current rate limit usage
// - Top rate-limited IPs
// - Historical trends
// - Abuse patterns
```

---

## Troubleshooting

### Issue: Legitimate user getting rate limited

**Solution:**
```bash
# Reset their rate limit
POST /api/admin/rate-limits
{
  "action": "reset",
  "identifier": "user:USER_ID",
  "endpoint": "authenticated"
}
```

### Issue: Rate limits too strict

**Solution:**
1. Check metrics to see which endpoint is problematic
2. Adjust the limit in `RATE_LIMITS` configuration
3. Restart server
4. Monitor for a few hours

### Issue: Memory usage high

**Solution:**
1. Check cache size: `GET /api/admin/rate-limits`
2. If approaching 10,000 entries, consider:
   - Reducing cache TTL
   - Implementing Redis backend
   - Increasing cache size (with caution)

---

## Security Considerations

1. **IP Spoofing:** The system trusts `X-Forwarded-For` header
   - Mitigation: Ensure proxy/load balancer sanitizes this header

2. **User ID Enumeration:** Admin API reveals user IDs
   - Mitigation: Admin API requires SYSTEM_ADMIN/ORG_ADMIN role

3. **Cache Size Attacks:** Attacker could fill cache with unique IPs
   - Mitigation: LRU cache with 10,000 entry limit

4. **Time-based Attacks:** Attacker could wait for window to reset
   - Mitigation: Acceptable trade-off; logs retained for analysis

---

## Compliance

The rate limiting system supports compliance requirements:

- **SOC 2:** Demonstrates security controls (CC6.1, CC6.6)
- **DPDP Act:** Prevents unauthorized data access attempts
- **GDPR:** Protects against enumeration attacks

---

## References

- Implementation: `src/lib/rateLimit.ts`
- Middleware: `src/middleware.ts`
- Admin API: `src/app/api/admin/rate-limits/route.ts`
- Audit Report: `COMPREHENSIVE_AUDIT_REPORT_FINAL.md`
- Pending Items: `PENDING_ITEMS.md`

---

**Document Owner:** Technical Lead  
**Last Updated:** February 10, 2026  
**Status:** ✅ Implemented and Tested
