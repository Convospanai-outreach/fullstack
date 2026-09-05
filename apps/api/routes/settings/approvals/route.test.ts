import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        approvalRequest: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

describe("GET /settings/approvals - tenant isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.approvalRequest.findMany.mockResolvedValue([]);
    });

    it("scopes the query to the caller's own team", async () => {
        await GET();

        expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith({
            where: { teamId: "team-1" },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
    });

    it("401s when there is no team context", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await GET();

        expect(res.status).toBe(401);
        expect(mockPrisma.approvalRequest.findMany).not.toHaveBeenCalled();
    });
});
