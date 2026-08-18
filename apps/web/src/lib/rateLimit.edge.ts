import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

type RateLimitStore = Map<string, RateLimitEntry>;

declare global {
  var __edgeRateLimitStore: RateLimitStore | undefined;
}

function getRateLimitStore(): RateLimitStore {
  if (!globalThis.__edgeRateLimitStore) {
    globalThis.__edgeRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalThis.__edgeRateLimitStore;
}

export const RATE_LIMITS = {
  PUBLIC: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
  AUTH: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
  },
  // Passive session-check endpoints (NextAuth's SessionProvider polling,
  // the Clerk auth-gate check on every dashboard page load) are hit far more
  // often than actual sign-in attempts and must not share the strict AUTH
  // bucket meant for brute-force protection.
  SESSION_CHECK: {
    windowMs: 60 * 1000,
    maxRequests: 60,
  },
  AUTHENTICATED: {
    windowMs: 60 * 1000,
    maxRequests: 1000,
  },
  ADMIN: {
    windowMs: 60 * 1000,
    maxRequests: 5000,
  },
  WEBHOOK: {
    windowMs: 60 * 1000,
    maxRequests: 50,
  },
  ERROR_LOGGING: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
} as const;

function getClientIdentifier(req: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  return `ip:${ip}`;
}

export async function applyRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  endpoint: string,
  userId?: string
): Promise<NextResponse | null> {
  if (process.env['NODE_ENV'] !== 'production' || process.env['DISABLE_RATE_LIMIT'] === 'true') {
    return null;
  }

  const now = Date.now();
  const identifier = getClientIdentifier(req, userId);
  const key = `${endpoint}:${identifier}`;
  const store = getRateLimitStore();
  const current = store.get(key);

  if (!current || now > current.resetTime) {
    store.set(key, { count: 1, resetTime: now + config.windowMs });
    return null;
  }

  if (current.count >= config.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((current.resetTime - now) / 1000));
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
        endpoint,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': current.resetTime.toString(),
        },
      }
    );
  }

  current.count += 1;
  store.set(key, current);
  return null;
}
