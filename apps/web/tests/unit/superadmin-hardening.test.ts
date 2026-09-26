import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// roadmap 3.4 / S-12: superadmin login had no per-IP limit, and its stateless
// HMAC session had no server-side way to revoke it.

const { mockUserFindUnique } = vi.hoisted(() => ({
    mockUserFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: { user: { findUnique: mockUserFindUnique } },
}));

import { POST } from "../../src/app/api/superadmin/login/route";
import { signSuperAdminToken, verifySuperAdminToken } from "../../src/lib/superadmin/session";
import { clearAllRateLimits } from "../../src/lib/rateLimit";

function loginFrom(ip: string) {
    return new Request("http://localhost/api/superadmin/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ email: "attacker-guess@example.com", password: "wrong" }),
    }) as any;
}

describe("POST /api/superadmin/login per-IP limiter", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await clearAllRateLimits();
        // Unknown account -> generic 401, so every allowed attempt reaches the DB lookup.
        mockUserFindUnique.mockResolvedValue(null);
    });

    it("throttles one IP after 5 attempts, before any DB lookup", async () => {
        for (let i = 0; i < 5; i++) {
            const res = await POST(loginFrom("203.0.113.7"));
            expect(res.status).toBe(401);
        }

        const blocked = await POST(loginFrom("203.0.113.7"));

        expect(blocked.status).toBe(429);
        expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
        // The 6th attempt never reached the account lookup (or the failure counter).
        expect(mockUserFindUnique).toHaveBeenCalledTimes(5);
    });

    it("keeps a different IP's attempts in its own bucket", async () => {
        for (let i = 0; i < 6; i++) await POST(loginFrom("203.0.113.7"));

        const other = await POST(loginFrom("198.51.100.20"));

        expect(other.status).toBe(401);
    });
});

describe("superadmin session revoke switch (SUPERADMIN_SESSION_VERSION)", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_SECRET", "test-nextauth-secret");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("keeps pre-existing cookies valid while the version is unset or empty", () => {
        // A cookie minted before this change: HMAC keyed on NEXTAUTH_SECRET alone.
        const expiresAt = Date.now() + 60_000;
        const payload = `sa_v1.admin-1.${Date.now()}.${expiresAt}`;
        const legacy = `${payload}.${createHmac("sha256", "test-nextauth-secret").update(payload).digest("hex")}`;

        vi.stubEnv("SUPERADMIN_SESSION_VERSION", "");
        expect(verifySuperAdminToken(legacy)).toBe("admin-1");
        expect(verifySuperAdminToken(signSuperAdminToken("admin-1"))).toBe("admin-1");
    });

    it("rejects every session signed under a previous version once it is rotated", () => {
        vi.stubEnv("SUPERADMIN_SESSION_VERSION", "1");
        const token = signSuperAdminToken("admin-1");
        expect(verifySuperAdminToken(token)).toBe("admin-1");

        vi.stubEnv("SUPERADMIN_SESSION_VERSION", "2");
        expect(verifySuperAdminToken(token)).toBeNull();
        // New logins under the new version work normally.
        expect(verifySuperAdminToken(signSuperAdminToken("admin-1"))).toBe("admin-1");
    });

    it("also revokes pre-existing cookies when a version is first set", () => {
        vi.stubEnv("SUPERADMIN_SESSION_VERSION", "");
        const token = signSuperAdminToken("admin-1");

        vi.stubEnv("SUPERADMIN_SESSION_VERSION", "1");
        expect(verifySuperAdminToken(token)).toBeNull();
    });
});
