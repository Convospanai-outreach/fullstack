import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAuthorizeRole } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        webhook: { findMany: vi.fn(), create: vi.fn() },
    },
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { OWNER: "owner", ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
    authorizeRole: mockAuthorizeRole,
}));

function postRequest(body: unknown) {
    return new Request("http://localhost/webhooks", { method: "POST", body: JSON.stringify(body) }) as any;
}

describe("/webhooks - listing and creation require ADMIN role (OPEN-213)", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.webhook.findMany.mockResolvedValue([{ id: "webhook-1", teamId: "team-1", secret: "s" }]);
        mockPrisma.webhook.create.mockResolvedValue({ id: "webhook-1", teamId: "team-1" });
    });

    it("GET rejects a caller below ADMIN role before returning webhook secrets", async () => {
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizeRole.mockRejectedValueOnce(new APIError("Insufficient permissions", 403));
        const { GET } = await import("./route");

        const response = await GET(new Request("http://localhost/webhooks") as any);

        expect(response.status).toBe(403);
        expect(mockPrisma.webhook.findMany).not.toHaveBeenCalled();
    });

    it("GET succeeds for an ADMIN caller", async () => {
        const { GET } = await import("./route");

        const response = await GET(new Request("http://localhost/webhooks") as any);

        expect(response.status).toBe(200);
        expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({ where: { teamId: "team-1" }, orderBy: { createdAt: "desc" } });
    });

    it("POST rejects a caller below ADMIN role before registering a webhook", async () => {
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizeRole.mockRejectedValueOnce(new APIError("Insufficient permissions", 403));
        const { POST } = await import("./route");

        const response = await POST(postRequest({ url: "https://attacker.example/collect", events: ["lead.created"] }));

        expect(response.status).toBe(403);
        expect(mockPrisma.webhook.create).not.toHaveBeenCalled();
    });

    it("POST succeeds for an ADMIN caller", async () => {
        const { POST } = await import("./route");

        const response = await POST(postRequest({ url: "https://example.com/hook", events: ["lead.created"] }));

        expect(response.status).toBe(201);
        expect(mockPrisma.webhook.create).toHaveBeenCalled();
    });
});
