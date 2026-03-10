import { vi } from 'vitest';
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  resetRateLimit, 
  clearAllRateLimits 
} from '../../src/lib/rateLimit';

// Mock Date.now to control time
const originalDateNow = Date.now;

describe('Rate Limiting Service', () => {
    beforeEach(async () => {
        // Clear all limits before each test
        await clearAllRateLimits();
        // Reset Date.now mock
        Date.now = originalDateNow;
    });

    it('should allow requests within limit', async () => {
        const identifier = 'test:allow';
        const config = { windowMs: 60000, maxRequests: 5 };

        // Make 5 requests (should all succeed)
        for (let i = 0; i < 5; i++) {
            const result = await checkRateLimit(identifier, config, 'test');
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4 - i);
        }
    });

    it('should block requests exceeding limit', async () => {
        const identifier = 'test:block';
        const config = { windowMs: 60000, maxRequests: 3 };

        // 3 allowed requests
        await checkRateLimit(identifier, config, 'test');
        await checkRateLimit(identifier, config, 'test');
        await checkRateLimit(identifier, config, 'test');

        // 4th request should be blocked
        const result = await checkRateLimit(identifier, config, 'test');
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('should reset limit after window falls', async () => {
        const identifier = 'test:reset';
        const config = { windowMs: 1000, maxRequests: 1 };

        // Mock time
        let currentTime = 10000;
        Date.now = vi.fn(() => currentTime);

        // First request allowed
        expect((await checkRateLimit(identifier, config, 'test')).allowed).toBe(true);
        
        // Second request blocked (same time)
        expect((await checkRateLimit(identifier, config, 'test')).allowed).toBe(false);

        // Move time forward past window (1000ms)
        currentTime = 12000;
        
        // Request should be allowed again
        const result = await checkRateLimit(identifier, config, 'test');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0); // 0 remaining because max is 1
    });

    it('should track different identifiers separately', async () => {
        const config = { windowMs: 60000, maxRequests: 1 };
        
        // User A uses up limit
        expect((await checkRateLimit('user:A', config, 'test')).allowed).toBe(true);
        expect((await checkRateLimit('user:A', config, 'test')).allowed).toBe(false);
        
        // User B should still be allowed
        expect((await checkRateLimit('user:B', config, 'test')).allowed).toBe(true);
    });

    it('should track different endpoints separately', async () => {
        const identifier = 'user:multi-endpoint';
        const config = { windowMs: 60000, maxRequests: 1 };
        
        // Endpoint A uses up limit
        expect((await checkRateLimit(identifier, config, 'endpoint-a')).allowed).toBe(true);
        expect((await checkRateLimit(identifier, config, 'endpoint-a')).allowed).toBe(false);
        
        // Endpoint B should still be allowed
        expect((await checkRateLimit(identifier, config, 'endpoint-b')).allowed).toBe(true);
    });

    it('should allow admin to reset limits', async () => {
        const identifier = 'user:reset-target';
        const config = { windowMs: 60000, maxRequests: 1 };
        
        // Block the user
        await checkRateLimit(identifier, config, 'test');
        expect((await checkRateLimit(identifier, config, 'test')).allowed).toBe(false);
        
        // Admin reset
        await resetRateLimit(identifier, 'test');
        
        // User should be allowed again
        expect((await checkRateLimit(identifier, config, 'test')).allowed).toBe(true);
    });

    it('should verify public rate limit configuration', () => {
        expect(RATE_LIMITS.PUBLIC.maxRequests).toBe(100);
        expect(RATE_LIMITS.PUBLIC.windowMs).toBe(60000);
    });

    it('should verify auth rate limit configuration', () => {
        expect(RATE_LIMITS.AUTH.maxRequests).toBe(5);
        expect(RATE_LIMITS.AUTH.windowMs).toBe(3600000);
    });
});
