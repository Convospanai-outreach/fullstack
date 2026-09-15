import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSessionCreate, mockSessionDeleteMany, mockGetCurrentContext } = vi.hoisted(() => ({
    mockSessionCreate: vi.fn(),
    mockSessionDeleteMany: vi.fn(),
    mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({
    prisma: {
        session: { create: mockSessionCreate, deleteMany: mockSessionDeleteMany },
    },
}));

import { POST } from "../route";

describe("POST /api/extension/token", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1" });
        mockSessionDeleteMany.mockResolvedValue({ count: 0 });
        mockSessionCreate.mockResolvedValue({});
    });

    it("garbage-collects this user's expired tokens before minting a new one", async () => {
        await POST();

        expect(mockSessionDeleteMany).toHaveBeenCalledWith({
            where: { userId: "user-1", expires: { lt: expect.any(Date) } },
        });
        // The cleanup must happen before the new row is created, not after.
        expect(mockSessionDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
            mockSessionCreate.mock.invocationCallOrder[0]
        );
    });

    it("rejects when there's no authenticated user", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null });

        const res = await POST();

        expect(res.status).toBe(401);
        expect(mockSessionCreate).not.toHaveBeenCalled();
    });
});
