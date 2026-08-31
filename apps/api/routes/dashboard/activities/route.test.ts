import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        activity: { findMany: vi.fn(), create: vi.fn() },
        campaign: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

function postRequest(body: unknown) {
    return new Request("http://localhost/api/dashboard/activities", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("/dashboard/activities - requires auth and is scoped to the caller's team", () => {
    beforeEach(() => vi.clearAllMocks());

    describe("GET", () => {
        it("rejects an unauthenticated caller instead of dumping every team's activity feed", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { GET } = await import("./route");

            const response = await GET();

            expect(response.status).toBe(401);
            expect(mockPrisma.activity.findMany).not.toHaveBeenCalled();
        });

        it("scopes the query to campaigns owned by the caller's team", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockPrisma.activity.findMany.mockResolvedValue([]);
            const { GET } = await import("./route");

            await GET();

            expect(mockPrisma.activity.findMany).toHaveBeenCalledWith({
                where: { campaign: { teamId: "team-1" } },
                orderBy: { createdAt: "desc" },
                take: 100,
            });
        });
    });

    describe("POST", () => {
        it("rejects an unauthenticated caller", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { POST } = await import("./route");

            const response = await POST(postRequest({ type: "NOTE", message: "hi" }));

            expect(response.status).toBe(401);
            expect(mockPrisma.activity.create).not.toHaveBeenCalled();
        });

        it("rejects attaching an activity to a campaign from another team", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockPrisma.campaign.findFirst.mockResolvedValue(null);
            const { POST } = await import("./route");

            const response = await POST(postRequest({ type: "NOTE", campaignId: "campaign-from-team-b" }));

            expect(response.status).toBe(404);
            expect(mockPrisma.activity.create).not.toHaveBeenCalled();
        });
    });
});
