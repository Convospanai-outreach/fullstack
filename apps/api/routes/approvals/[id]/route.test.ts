import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockHasPermission, mockPrisma, mockApprove, mockReject } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockHasPermission: vi.fn(),
    mockPrisma: { approvalRequest: { findFirst: vi.fn() }, teamMember: { count: vi.fn() } },
    mockApprove: vi.fn(),
    mockReject: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    hasPermission: mockHasPermission,
    Permission: { RESOLVE_APPROVALS: "resolve_approvals" },
}));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { approve: mockApprove, reject: mockReject } }));

import { POST } from "./route";

const decide = (action: string) =>
    POST(new Request("http://localhost/approvals/req-1", { method: "POST", body: JSON.stringify({ action }) }) as any, {
        params: Promise.resolve({ id: "req-1" }),
    });

describe("POST /approvals/[id] (api)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockHasPermission.mockResolvedValue(true);
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({ teamId: "team-1", actionType: "CAMPAIGN_START", requesterId: "user-1" });
        mockPrisma.teamMember.count.mockResolvedValue(1);
        mockApprove.mockResolvedValue({ id: "req-1" });
        mockReject.mockResolvedValue({ id: "req-1" });
    });

    it("needs RESOLVE_APPROVALS to approve or reject", async () => {
        mockHasPermission.mockResolvedValue(false);

        expect((await decide("APPROVE")).status).toBe(403);
        expect((await decide("REJECT")).status).toBe(403);
        expect(mockHasPermission).toHaveBeenCalledWith("user-1", "team-1", "resolve_approvals");
        expect(mockApprove).not.toHaveBeenCalled();
        expect(mockReject).not.toHaveBeenCalled();
    });

    it("refuses a campaign start approved by its own requester while another admin could", async () => {
        expect((await decide("APPROVE")).status).toBe(403);
        expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "req-1", teamId: "team-1" } }));
        expect(mockApprove).not.toHaveBeenCalled();
    });

    it("approves for a sole approver, and lets the requester reject", async () => {
        mockPrisma.teamMember.count.mockResolvedValue(0);
        expect((await decide("APPROVE")).status).toBe(200);
        expect(mockApprove).toHaveBeenCalledWith("req-1", "user-1", "team-1");

        mockPrisma.teamMember.count.mockResolvedValue(1);
        expect((await decide("REJECT")).status).toBe(200);
    });
});
