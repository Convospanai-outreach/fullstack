import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizePermission, mockPrisma, mockApprove, mockReject } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizePermission: vi.fn(),
    mockPrisma: { approvalRequest: { findMany: vi.fn() } },
    mockApprove: vi.fn(),
    mockReject: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/permissions")>();
    return { ...actual, authorizePermission: mockAuthorizePermission };
});
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/governance/messageApproval", () => ({
    approveMessageSend: mockApprove,
    rejectMessageSend: mockReject,
}));

function postRequest(body: unknown) {
    return new Request("http://localhost/api/approvals/bulk", { method: "POST", body: JSON.stringify(body) }) as any;
}

describe("POST /api/approvals/bulk", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizePermission.mockResolvedValue(undefined);
    });

    it("rejects a caller without RESOLVE_APPROVALS before reading anything", async () => {
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizePermission.mockRejectedValue(new APIError("Insufficient permissions: Requires resolve_approvals", 403));
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "APPROVE", ids: ["a"] }));

        expect(response.status).toBe(403);
        expect(mockPrisma.approvalRequest.findMany).not.toHaveBeenCalled();
        expect(mockApprove).not.toHaveBeenCalled();
    });

    it("refuses a bad action, an empty list and an oversized list", async () => {
        const { POST } = await import("./route");

        expect((await POST(postRequest({ action: "SKIP", ids: ["a"] }))).status).toBe(400);
        expect((await POST(postRequest({ action: "APPROVE", ids: [] }))).status).toBe(400);
        expect((await POST(postRequest({ action: "APPROVE", ids: Array.from({ length: 51 }, (_, i) => `id${i}`) }))).status).toBe(400);
        expect(mockApprove).not.toHaveBeenCalled();
    });

    it("looks rows up by this team and message type only", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([]);
        const { POST } = await import("./route");

        await POST(postRequest({ action: "APPROVE", ids: ["a", "a", "b"] }));

        expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith({
            where: { id: { in: ["a", "b"] }, teamId: "team-1", actionType: "MESSAGE_SEND" },
        });
    });

    it("approves each message and keeps going when one fails or is not a message of this team", async () => {
        const row = (id: string) => ({ id, status: "PENDING", payload: {} });
        mockPrisma.approvalRequest.findMany.mockResolvedValue([row("a"), row("b")]);
        mockApprove.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("This message approval has expired or was already decided."));
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "APPROVE", ids: ["a", "b", "other-team"] }));
        const data = await response.json();

        expect(mockApprove).toHaveBeenCalledTimes(2);
        expect(mockApprove).toHaveBeenCalledWith(row("a"), "team-1", "user-1");
        expect(data.results).toEqual([
            { id: "a", ok: true },
            { id: "b", ok: false, error: "This message approval has expired or was already decided." },
            { id: "other-team", ok: false, error: "Not a message waiting for approval." },
        ]);
    });

    it("rejects with the reason, and reports a message that was already decided", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
        mockReject.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "REJECT", reason: "Off brand", ids: ["a", "b"] }));
        const data = await response.json();

        expect(mockReject).toHaveBeenCalledWith("a", "team-1", "user-1", "Off brand");
        expect(mockApprove).not.toHaveBeenCalled();
        expect(data.results).toEqual([{ id: "a", ok: true }, { id: "b", ok: false, error: "Already decided." }]);
    });
});
