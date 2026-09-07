import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizePermission, mockPrisma, mockHandleEmailSending } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizePermission: vi.fn(),
    mockPrisma: {
        approvalRequest: { findUnique: vi.fn(), update: vi.fn() },
        email: { update: vi.fn(), findFirst: vi.fn() },
        lead: { update: vi.fn(), findFirst: vi.fn() },
        campaign: { findFirst: vi.fn() },
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

    it("OPEN-203: ignores a leadId/campaignId in the payload that belongs to another team instead of mutating or emailing through it", async () => {
        mockAuthorizePermission.mockResolvedValue(undefined);
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: "req-1",
            teamId: "team-1",
            entityType: "MCP_TOOL_EXECUTION",
            actionType: "SEND_EMAIL",
            payload: { leadId: "victim-lead", campaignId: "victim-campaign", emailId: "victim-email" },
        });
        mockPrisma.approvalRequest.update.mockResolvedValue({ id: "req-1", status: "APPROVED" });
        // Every ownership lookup fails: none of these entities belong to team-1
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.email.findFirst.mockResolvedValue(null);
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "APPROVE" }), paramsFor("req-1"));

        expect(response.status).toBe(200);
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({ where: { id: "victim-campaign", teamId: "team-1" }, select: { id: true } });
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "victim-lead", teamId: "team-1" }, select: { id: true } });
        expect(mockPrisma.email.update).not.toHaveBeenCalled();
        expect(mockPrisma.lead.update).not.toHaveBeenCalled();
        expect(mockHandleEmailSending).not.toHaveBeenCalled();
    });

    it("proceeds with the email/lead side effects when the payload's ids do belong to the caller's own team", async () => {
        mockAuthorizePermission.mockResolvedValue(undefined);
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: "req-1",
            teamId: "team-1",
            entityType: "lead",
            actionType: "SEND_EMAIL",
            payload: { leadId: "lead-1", campaignId: "campaign-1" },
        });
        mockPrisma.approvalRequest.update.mockResolvedValue({ id: "req-1", status: "APPROVED" });
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1" });
        mockPrisma.lead.update.mockResolvedValue({ id: "lead-1" });
        mockHandleEmailSending.mockResolvedValue({ status: "sent" });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ action: "APPROVE" }), paramsFor("req-1"));

        expect(response.status).toBe(200);
        expect(mockPrisma.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { status: "SENT" } });
        expect(mockHandleEmailSending).toHaveBeenCalledWith(expect.objectContaining({ leadId: "lead-1", campaignId: "campaign-1", teamId: "team-1" }));
    });
});
