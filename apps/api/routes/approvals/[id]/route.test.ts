import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockAuthorizePermission, mockApprove, mockReject } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockAuthorizePermission: vi.fn(),
    mockApprove: vi.fn(),
    mockReject: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/permissions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/permissions")>();
    return { ...actual, authorizePermission: mockAuthorizePermission };
});
vi.mock("@/modules/governance/ApprovalService", () => ({
    ApprovalService: { approve: mockApprove, reject: mockReject },
}));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/approvals/req-1", { method: "POST", body: JSON.stringify(body) }) as any;
}
const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /approvals/[id] - requires RESOLVE_APPROVALS", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizePermission.mockResolvedValue(undefined);
        mockApprove.mockResolvedValue({ id: "req-1" });
        mockReject.mockResolvedValue({ id: "req-1" });
    });

    it.each(["APPROVE", "REJECT"])("rejects a caller without the permission before %s reaches the service", async (action) => {
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizePermission.mockRejectedValue(new APIError("Insufficient permissions: Requires resolve_approvals", 403));

        const response = await POST(postRequest({ action }), paramsFor("req-1"));

        expect(response.status).toBe(403);
        expect(mockApprove).not.toHaveBeenCalled();
        expect(mockReject).not.toHaveBeenCalled();
    });

    it("401s with no session", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });

        const response = await POST(postRequest({ action: "APPROVE" }), paramsFor("req-1"));

        expect(response.status).toBe(401);
        expect(mockAuthorizePermission).not.toHaveBeenCalled();
    });

    it("approves for a caller with the permission", async () => {
        const response = await POST(postRequest({ action: "APPROVE" }), paramsFor("req-1"));

        expect(response.status).toBe(200);
        expect(mockAuthorizePermission).toHaveBeenCalledWith("user-1", "team-1", "resolve_approvals");
        expect(mockApprove).toHaveBeenCalledWith("req-1", "user-1", "team-1");
    });

    it("passes the service's 403 (e.g. self-approval) through instead of turning it into a 500", async () => {
        const { APIError } = await import("@/lib/apiResponse");
        mockApprove.mockRejectedValue(new APIError("A campaign start request must be approved by someone other than the person who requested it.", 403));

        const response = await POST(postRequest({ action: "APPROVE" }), paramsFor("req-1"));

        expect(response.status).toBe(403);
    });
});
