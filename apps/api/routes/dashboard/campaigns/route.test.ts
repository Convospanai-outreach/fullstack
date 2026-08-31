import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findMany: vi.fn(), create: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

function postRequest(body: unknown) {
    return new Request("http://localhost/api/dashboard/campaigns", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("/dashboard/campaigns - requires auth and is scoped to the caller's team", () => {
    beforeEach(() => vi.clearAllMocks());

    describe("GET", () => {
        it("rejects an unauthenticated caller instead of dumping every team's campaigns (incl. aiConfig secrets)", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { GET } = await import("./route");

            const response = await GET();

            expect(response.status).toBe(401);
            expect(mockPrisma.campaign.findMany).not.toHaveBeenCalled();
        });

        it("scopes the query to the caller's own team", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockPrisma.campaign.findMany.mockResolvedValue([]);
            const { GET } = await import("./route");

            await GET();

            expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1" },
                orderBy: { updatedAt: "desc" },
            });
        });
    });

    describe("POST", () => {
        it("rejects an unauthenticated caller", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { POST } = await import("./route");

            const response = await POST(postRequest({ name: "Q1" }));

            expect(response.status).toBe(401);
            expect(mockPrisma.campaign.create).not.toHaveBeenCalled();
        });

        it("ignores a caller-supplied ownerId and uses the session's real userId, and stamps the session's teamId", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "real-user", teamId: "real-team" });
            mockPrisma.campaign.create.mockResolvedValue({ id: "campaign-1" });
            const { POST } = await import("./route");

            await POST(postRequest({ name: "Q1", ownerId: "attacker-supplied-user" }));

            expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ ownerId: "real-user", teamId: "real-team" }),
            });
        });
    });
});
