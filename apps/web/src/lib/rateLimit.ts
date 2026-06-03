/**
 * Comprehensive Rate Limiting Service
 * 
 * Provides multi-tier rate limiting for:
 * - Public APIs
 * - Authenticated APIs
 * - Admin APIs
 * - Webhook endpoints
 * 
 * Uses in-memory LRU cache for development
 * Redis-backed for production (optional)
 */

import { LRUCache } from 'lru-cache';
import { NextRequest, NextResponse } from 'next/server';
import { safeGet, safeDel, getRedisClient } from './redis';
import { logger } from './logger';

interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  maxRequests: number;    // Max requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// LRU cache for rate limit tracking (in-memory)
const rateLimitCache = new LRUCache<string, RateLimitEntry>({
  max: 10000,               // Max 10k unique IPs/keys tracked
  ttl: 1000 * 60 * 60,     // 1 hour TTL
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

/**
 * Rate limit configurations by endpoint type
 */
export const RATE_LIMITS = {
  // Public unauthenticated APIs (per IP)
  PUBLIC: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,         // 100 requests per minute
  },

  // Authentication endpoints (stricter)
  AUTH: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,           // 5 attempts per hour
  },

  // Authenticated user APIs (per user)
  AUTHENTICATED: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 1000,        // 1000 requests per minute
  },

  // Admin APIs (high limit, logged)
  ADMIN: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 5000,        // 5000 requests per minute
  },

  // Webhook endpoints (per source)
  WEBHOOK: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 50,          // 50 requests per minute
  },

  // Registration endpoint
  REGISTRATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,           // 5 attempts per hour
  },

  // Error logging endpoint
  ERROR_LOGGING: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 errors per minute per IP
  },
} as const;

/**
 * Get client identifier from request
 * Priority: User ID > API Key > IP Address
 */
export function getClientIdentifier(req: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Check for API key
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  // Fall back to IP address
  const ip =
    (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ||
    req.headers.get('x-real-ip') ||
    'unknown';

  return `ip:${ip}`;
}


/**
 * Check if request is rate limited
 * Returns null if allowed, or NextResponse with 429 if blocked
 * 
 * Supports Hybrid Mode: Redis Primary -> LRU Secondary
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const now = Date.now();

  if (process.env['DISABLE_RATE_LIMIT'] === 'true') {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }

  const key = `ratelimit:${endpoint}:${identifier}`;

  // 1. Try Redis First
  const redisClient = await getRedisClient();
  if (redisClient && redisClient.isOpen) {
    try {
      const data = await redisClient.get(key);
      let entry: RateLimitEntry;

      if (data) {
        entry = JSON.parse(data);
      } else {
        entry = { count: 0, resetTime: now + config.windowMs };
      }

      // Check if window expired
      if (now > entry.resetTime) {
        entry = { count: 0, resetTime: now + config.windowMs };
      }

      // Check Limits
      if (entry.count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime
        };
      }

      // Increment
      entry.count += 1;

      // Calculate TTL in seconds
      const ttl = Math.ceil((entry.resetTime - now) / 1000);
      if (ttl > 0) {
        await redisClient.set(key, JSON.stringify(entry), { EX: ttl });
      }

      return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetTime
      };

    } catch (error) {
      logger.warn("Redis Rate Limit Failed, falling back to LRU", error);
    }
  }

  // 2. Fallback to LRU (In-Memory)
  return checkRateLimitLRU(identifier, config, endpoint);
}

/**
 * In-memory LRU implementation (Synchronous)
 */
function checkRateLimitLRU(
  identifier: string,
  config: RateLimitConfig,
  endpoint: string
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = `${endpoint}:${identifier}`;
  const entry = rateLimitCache.get(key);

  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitCache.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  entry.count += 1;
  rateLimitCache.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Apply rate limit and return response if blocked
 */
export async function applyRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  endpoint: string,
  userId?: string
): Promise<NextResponse | null> {
  // Bypass rate limiting in test or development if explicitly disabled
  if (process.env['NODE_ENV'] !== 'production' || process.env['DISABLE_RATE_LIMIT'] === 'true') {
    return null;
  }

  const identifier = getClientIdentifier(req, userId);
  const result = await checkRateLimit(identifier, config, endpoint);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

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
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    );
  }

  // Add rate limit headers to response
  // Note: These will be added by the middleware
  return null;
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  config: RateLimitConfig,
  remaining: number,
  resetTime: number
): NextResponse {
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', resetTime.toString());

  return response;
}

/**
 * Reset rate limit for a specific identifier (admin use)
 */
export async function resetRateLimit(identifier: string, endpoint: string): Promise<void> {
  // Clear LRU
  const key = `${endpoint}:${identifier}`;
  rateLimitCache.delete(key);

  // Clear Redis
  await safeDel(`ratelimit:${endpoint}:${identifier}`);
}

/**
 * Get rate limit status for monitoring
 */
export async function getRateLimitStatus(identifier: string, endpoint: string): Promise<RateLimitEntry | null> {
  // Check Redis first
  const redisKey = `ratelimit:${endpoint}:${identifier}`;
  const redisData = await safeGet(redisKey);
  if (redisData) {
    return JSON.parse(redisData);
  }

  // Fallback to LRU
  const key = `${endpoint}:${identifier}`;
  return rateLimitCache.get(key) || null;
}

/**
 * Clear all rate limits (admin use, testing)
 */
export async function clearAllRateLimits(): Promise<void> {
  rateLimitCache.clear();

  // Redis clear is tricky/dangerous to do globally, so we log a warning
  // Ideally, use SCAN to find keys with prefix 'ratelimit:*'
  const client = await getRedisClient();
  if (client && client.isOpen) {
    // Allow dangerous flushDB for dev environments only?
    // For now, we only clear memory cache for immediate relief
    logger.info("[RateLimit] Cleared in-memory cache. Redis keys remain until TTL expires.");
  }
}

/**
 * Get cache statistics
 */
export function getRateLimitStats() {
  return {
    size: rateLimitCache.size,
    maxSize: rateLimitCache.max,
    calculatedSize: rateLimitCache.calculatedSize,
  };
}
