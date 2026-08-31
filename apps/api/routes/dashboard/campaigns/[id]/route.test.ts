import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAuthorizeRole } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { updateMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    },
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { OWNER: "owner", ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
    authorizeRole: mockAuthorizeRole,
}));

function patchRequest(body: unknown) {
    return new Request("http://localhost/api/dashboard/campaigns/campaign-1", {
        method: "PATCH",
        body: JSON.stringify(body),
    }) as any;
}

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("/dashboard/campaigns/[id] - requires auth and is scoped to the caller's team", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    describe("PATCH", () => {
        it("rejects a caller below MEMBER role (this route had no role check at all before the fix)", async () => {
            const { APIError } = await import("@/lib/apiResponse");
            mockAuthorizeRole.mockRejectedValueOnce(new APIError("Insufficient permissions", 403));
            const { PATCH } = await import("./route");

            const response = await PATCH(patchRequest({ name: "x" }), paramsFor("campaign-1"));

            expect(response.status).toBe(403);
            expect(mockPrisma.campaign.updateMany).not.toHaveBeenCalled();
        });

        it("rejects an unauthenticated caller", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { PATCH } = await import("./route");

            const response = await PATCH(patchRequest({ name: "x" }), paramsFor("campaign-1"));

            expect(response.status).toBe(401);
            expect(mockPrisma.campaign.updateMany).not.toHaveBeenCalled();
        });

        it("rejects updating a campaign belonging to another team", async () => {
            mockPrisma.campaign.updateMany.mockResolvedValue({ count: 0 });
            const { PATCH } = await import("./route");

            const response = await PATCH(patchRequest({ name: "x" }), paramsFor("campaign-from-team-b"));

            expect(response.status).toBe(404);
            expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith({
                where: { id: "campaign-from-team-b", teamId: "team-1" },
                data: { name: "x" },
            });
        });

        it("strips id/teamId/ownerId from the update payload (mass-assignment guard)", async () => {
            mockPrisma.campaign.updateMany.mockResolvedValue({ count: 1 });
            mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", name: "x" });
            const { PATCH } = await import("./route");

            await PATCH(
                patchRequest({ name: "x", id: "attacker-id", teamId: "attacker-team", ownerId: "attacker-user" }),
                paramsFor("campaign-1")
            );

            expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith({
                where: { id: "campaign-1", teamId: "team-1" },
                data: { name: "x" },
            });
        });
    });

    describe("DELETE", () => {
        it("rejects a caller below ADMIN role (this route had no role check at all before the fix)", async () => {
            const { APIError } = await import("@/lib/apiResponse");
            mockAuthorizeRole.mockRejectedValueOnce(new APIError("Insufficient permissions", 403));
            const { DELETE } = await import("./route");

            const response = await DELETE(new Request("http://localhost") as any, paramsFor("campaign-1"));

            expect(response.status).toBe(403);
            expect(mockPrisma.campaign.deleteMany).not.toHaveBeenCalled();
        });

        it("rejects an unauthenticated caller", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { DELETE } = await import("./route");

            const response = await DELETE(new Request("http://localhost") as any, paramsFor("campaign-1"));

            expect(response.status).toBe(401);
            expect(mockPrisma.campaign.deleteMany).not.toHaveBeenCalled();
        });

        it("scopes the delete to the caller's team", async () => {
            mockPrisma.campaign.deleteMany.mockResolvedValue({ count: 1 });
            const { DELETE } = await import("./route");

            await DELETE(new Request("http://localhost") as any, paramsFor("campaign-1"));

            expect(mockPrisma.campaign.deleteMany).toHaveBeenCalledWith({
                where: { id: "campaign-1", teamId: "team-1" },
            });
        });
    });
});
