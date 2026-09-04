import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockBulkService } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockBulkService: {
        deleteResources: vi.fn(),
        tagResources: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/modules/bulk/service/BulkService", () => ({ bulkService: mockBulkService }));

function postRequest(body: unknown) {
    return new Request("http://localhost/bulk/action", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /bulk/action", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects a caller with no team context", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: null });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "delete", type: "lead", ids: ["lead-1"] }));

        expect(response.status).toBe(401);
        expect(mockBulkService.deleteResources).not.toHaveBeenCalled();
    });

    it("scopes a delete action to the caller's own team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockBulkService.deleteResources.mockResolvedValue({ count: 1 });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "delete", type: "lead", ids: ["lead-1"] }));

        expect(response.status).toBe(200);
        expect(mockBulkService.deleteResources).toHaveBeenCalledWith("lead", ["lead-1"], "team-1");
    });

    it("scopes a tag action to the caller's own team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockBulkService.tagResources.mockResolvedValue({ count: 1 });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "tag", type: "lead", ids: ["lead-1"], payload: { tags: ["vip"] } }));

        expect(response.status).toBe(200);
        expect(mockBulkService.tagResources).toHaveBeenCalledWith("lead", ["lead-1"], ["vip"], "team-1");
    });
});
