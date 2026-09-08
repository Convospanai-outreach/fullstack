import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const { mockGetAdminUser, mockGetRateLimitStats, mockGetRateLimitStatus, mockResetRateLimit, mockClearAllRateLimits } = vi.hoisted(() => ({
    mockGetAdminUser: vi.fn(),
    mockGetRateLimitStats: vi.fn(),
    mockGetRateLimitStatus: vi.fn(),
    mockResetRateLimit: vi.fn(),
    mockClearAllRateLimits: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/rateLimit", () => ({
    getRateLimitStats: mockGetRateLimitStats,
    getRateLimitStatus: mockGetRateLimitStatus,
    resetRateLimit: mockResetRateLimit,
    clearAllRateLimits: mockClearAllRateLimits,
}));

import { GET, POST } from "./route";

function postRequest(body: any) {
    return new Request("http://localhost/api/admin/rate-limits", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("admin/rate-limits route - platform-admin scoping (OPEN-226)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("GET", () => {
        it("403s a self-service ORG_ADMIN and never returns stats", async () => {
            mockGetAdminUser.mockResolvedValue(null);

            const res = await GET({} as any);

            expect(res.status).toBe(403);
            expect(mockGetAdminUser).toHaveBeenCalledWith(UserRole.SYSTEM_ADMIN);
            expect(mockGetRateLimitStats).not.toHaveBeenCalled();
        });

        it("allows a genuine SYSTEM_ADMIN to view stats", async () => {
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockGetRateLimitStats.mockReturnValue({ size: 0 });

            const res = await GET({} as any);

            expect(res.status).toBe(200);
            expect(mockGetRateLimitStats).toHaveBeenCalled();
        });
    });

    describe("POST", () => {
        it("403s a self-service ORG_ADMIN attempting to clear platform-wide rate limits", async () => {
            mockGetAdminUser.mockResolvedValue(null);

            const res = await POST(postRequest({ action: "clear" }));

            expect(res.status).toBe(403);
            expect(mockGetAdminUser).toHaveBeenCalledWith(UserRole.SYSTEM_ADMIN);
            expect(mockClearAllRateLimits).not.toHaveBeenCalled();
        });

        it("403s a self-service ORG_ADMIN attempting to reset another identifier's rate limit", async () => {
            mockGetAdminUser.mockResolvedValue(null);

            const res = await POST(postRequest({ action: "reset", identifier: "victim", endpoint: "/api/auth/login" }));

            expect(res.status).toBe(403);
            expect(mockResetRateLimit).not.toHaveBeenCalled();
        });

        it("allows a genuine SYSTEM_ADMIN to clear all rate limits", async () => {
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockClearAllRateLimits.mockResolvedValue(undefined);

            const res = await POST(postRequest({ action: "clear" }));

            expect(res.status).toBe(200);
            expect(mockClearAllRateLimits).toHaveBeenCalled();
        });
    });
});
