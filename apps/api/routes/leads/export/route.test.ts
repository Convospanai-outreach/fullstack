import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockPrisma: {
        lead: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/permissions")>();
    return { ...actual, authorizeRole: mockAuthorizeRole };
});

describe("GET /api/leads/export - requires auth and is scoped to the caller's team", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects an unauthenticated caller instead of dumping every lead in the database", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { GET } = await import("./route");

        const response = await GET();

        expect(response.status).toBe(401);
        expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
    });

    it("scopes the export query to the caller's own team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.lead.findMany.mockResolvedValue([]);
        const { GET } = await import("./route");

        await GET();

        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith({
            where: { teamId: "team-1" },
            orderBy: { createdAt: "desc" },
        });
    });

    it("propagates the 403 from a caller lacking MEMBER role instead of exporting", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizeRole.mockRejectedValue(new APIError("Insufficient permissions", 403));
        const { GET } = await import("./route");

        const response = await GET();

        expect(response.status).toBe(403);
        expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
    });
});
