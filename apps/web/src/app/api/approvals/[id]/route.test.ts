import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizePermission, mockPrisma, mockHandleEmailSending } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizePermission: vi.fn(),
    mockPrisma: {
        approvalRequest: { findUnique: vi.fn(), update: vi.fn() },
        email: { update: vi.fn() },
        lead: { update: vi.fn() },
    },
    mockHandleEmailSending: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/permissions")>();
    return { ...actual, authorizePermission: mockAuthorizePermission };
});
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/workers/handlers/email-sending-worker", () => ({ handleEmailSending: mockHandleEmailSending }));

function postRequest(body: unknown) {
    return new Request("http://localhost/api/approvals/req-1", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /api/approvals/[id] - requires RESOLVE_APPROVALS permission", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("rejects a caller without RESOLVE_APPROVALS (e.g. a plain member or viewer)", async () => {
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizePermission.mockRejectedValue(new APIError("Insufficient permissions: Requires resolve_approvals", 403));
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "APPROVE" }), paramsFor("req-1"));

        expect(response.status).toBe(403);
        expect(mockPrisma.approvalRequest.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.approvalRequest.update).not.toHaveBeenCalled();
    });

    it("rejects with no session before checking permission", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "APPROVE" }), paramsFor("req-1"));

        expect(response.status).toBe(401);
        expect(mockAuthorizePermission).not.toHaveBeenCalled();
    });

    it("allows an authorized reviewer to reject a request belonging to their team", async () => {
        mockAuthorizePermission.mockResolvedValue(undefined);
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({ id: "req-1", teamId: "team-1", payload: {}, entityType: "lead" });
        mockPrisma.approvalRequest.update.mockResolvedValue({ id: "req-1", status: "REJECTED" });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "REJECT" }), paramsFor("req-1"));

        expect(response.status).toBe(200);
        expect(mockAuthorizePermission).toHaveBeenCalledWith("user-1", "team-1", "resolve_approvals");
    });

    it("still rejects a request belonging to a different team even with permission", async () => {
        mockAuthorizePermission.mockResolvedValue(undefined);
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({ id: "req-1", teamId: "other-team" });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "APPROVE" }), paramsFor("req-1"));

        expect(response.status).toBe(404);
        expect(mockPrisma.approvalRequest.update).not.toHaveBeenCalled();
    });
});
