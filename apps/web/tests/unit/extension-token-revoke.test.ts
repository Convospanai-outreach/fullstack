import { beforeEach, describe, expect, it, vi } from "vitest";

// roadmap 3.4 / S-11: extension tokens (Session rows) had no revoke path.

const { mockSessionDeleteMany, mockGetCurrentContext } = vi.hoisted(() => ({
    mockSessionDeleteMany: vi.fn(),
    mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({
    prisma: { session: { deleteMany: mockSessionDeleteMany } },
}));

import { DELETE } from "../../src/app/api/extension/token/route";

describe("DELETE /api/extension/token (revoke)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deletes only the calling user's extension tokens", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1" });
        mockSessionDeleteMany.mockResolvedValue({ count: 2 });

        const res = await DELETE();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, revoked: 2 });
        // Exactly the caller's rows - never an unscoped deleteMany.
        expect(mockSessionDeleteMany).toHaveBeenCalledTimes(1);
        expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });

    it("rejects an unauthenticated caller without touching any tokens", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null });

        const res = await DELETE();

        expect(res.status).toBe(401);
        expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    });
});
