import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAuthorizeRole } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        webhook: { findUnique: vi.fn(), delete: vi.fn() },
    },
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { OWNER: "owner", ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
    authorizeRole: mockAuthorizeRole,
}));

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("DELETE /webhooks/[id] - requires ADMIN role", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("rejects a caller below ADMIN role (this route had no role check at all before the fix)", async () => {
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizeRole.mockRejectedValueOnce(new APIError("Insufficient permissions", 403));
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost") as any, paramsFor("webhook-1"));

        expect(response.status).toBe(403);
        expect(mockPrisma.webhook.delete).not.toHaveBeenCalled();
    });

    it("deletes the webhook when the caller is an ADMIN and owns it", async () => {
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.webhook.findUnique.mockResolvedValue({ id: "webhook-1", teamId: "team-1" });
        mockPrisma.webhook.delete.mockResolvedValue({ id: "webhook-1" });
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost") as any, paramsFor("webhook-1"));

        expect(response.status).toBe(200);
        expect(mockPrisma.webhook.delete).toHaveBeenCalledWith({ where: { id: "webhook-1" } });
    });
});
