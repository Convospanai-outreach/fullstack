import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckTeamPermission, mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockCheckTeamPermission: vi.fn(),
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        experiment: { findMany: vi.fn() },
        trainingDataset: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    checkTeamPermission: mockCheckTeamPermission,
}));

describe("GET /governance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.experiment.findMany.mockResolvedValue([]);
        mockPrisma.trainingDataset.findMany.mockResolvedValue([]);
    });

    it("OPEN-207: scopes experiments to the caller's own team instead of returning every team's", async () => {
        const { GET } = await import("./route");

        await GET();

        expect(mockPrisma.experiment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-1" } })
        );
    });

    it("rejects a caller without ADMIN permission on their own team", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        const { GET } = await import("./route");

        const response = await GET();

        expect(response.status).toBe(403);
        expect(mockPrisma.experiment.findMany).not.toHaveBeenCalled();
    });

    it("rejects with no session", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { GET } = await import("./route");

        const response = await GET();

        expect(response.status).toBe(401);
        expect(mockPrisma.experiment.findMany).not.toHaveBeenCalled();
    });
});
