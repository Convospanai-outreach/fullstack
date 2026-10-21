import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        organizationPolicy: { findUnique: vi.fn() },
        approvalRequest: { findFirst: vi.fn(), create: vi.fn() },
        teamMember: { count: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { checkCampaignStartApproval, isBlockedSelfApproval } from "./campaignStartApproval";

const args = { teamId: "team-1", userId: "user-1", campaignId: "campaign-1" };

describe("checkCampaignStartApproval", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.organizationPolicy.findUnique.mockResolvedValue({ requiresApprovalForCampaign: true });
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        mockPrisma.approvalRequest.create.mockResolvedValue({ id: "new-approval" });
    });

    it("allows the start when the team has no policy row", async () => {
        mockPrisma.organizationPolicy.findUnique.mockResolvedValue(null);

        expect(await checkCampaignStartApproval(args)).toEqual({ allowed: true });
        expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();
    });

    it("allows the start when the policy does not require approval", async () => {
        mockPrisma.organizationPolicy.findUnique.mockResolvedValue({ requiresApprovalForCampaign: false });

        expect(await checkCampaignStartApproval(args)).toEqual({ allowed: true });
        expect(mockPrisma.approvalRequest.findFirst).not.toHaveBeenCalled();
    });

    it("allows the start once a CAMPAIGN_START request for this campaign is approved", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: "a1", status: "APPROVED" });

        expect(await checkCampaignStartApproval(args)).toEqual({ allowed: true });
        expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId: "team-1", entityType: "Campaign", entityId: "campaign-1", actionType: "CAMPAIGN_START" },
            }),
        );
    });

    it("reports the existing request while approval is still pending, without creating another", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: "a1", status: "PENDING" });

        const result = await checkCampaignStartApproval(args);

        expect(result).toMatchObject({ allowed: false, status: 202, body: { status: "pending_approval", approvalId: "a1" } });
        expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();
    });

    it("files a new request when none exists", async () => {
        const result = await checkCampaignStartApproval(args);

        expect(result).toMatchObject({ allowed: false, status: 202, body: { status: "pending_approval", approvalId: "new-approval" } });
        expect(mockPrisma.approvalRequest.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                teamId: "team-1",
                requesterId: "user-1",
                entityType: "Campaign",
                entityId: "campaign-1",
                actionType: "CAMPAIGN_START",
                status: "PENDING",
            }),
        });
    });

    it.each(["REJECTED"])("files a fresh request after the previous one was %s, so a denial is not permanent", async (status) => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: "old", status });

        const result = await checkCampaignStartApproval(args);

        expect(result).toMatchObject({ allowed: false, status: 202, body: { approvalId: "new-approval" } });
        expect(mockPrisma.approvalRequest.create).toHaveBeenCalledTimes(1);
    });
});

describe("isBlockedSelfApproval", () => {
    const own = { teamId: "team-1", actionType: "CAMPAIGN_START", requesterId: "user-1" };

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.teamMember.count.mockResolvedValue(1);
    });

    it("blocks the requester while another active owner or admin could approve", async () => {
        expect(await isBlockedSelfApproval(own, "user-1")).toBe(true);
        expect(mockPrisma.teamMember.count).toHaveBeenCalledWith({
            where: { teamId: "team-1", status: "active", role: { in: ["owner", "admin"] }, userId: { not: "user-1" } },
        });
    });

    it("lets the requester approve when they are the team's only approver", async () => {
        mockPrisma.teamMember.count.mockResolvedValue(0);
        expect(await isBlockedSelfApproval(own, "user-1")).toBe(false);
    });

    it("never blocks someone else's request or other approval types", async () => {
        expect(await isBlockedSelfApproval(own, "user-2")).toBe(false);
        expect(await isBlockedSelfApproval({ ...own, actionType: "SEND_EMAIL" }, "user-1")).toBe(false);
        expect(mockPrisma.teamMember.count).not.toHaveBeenCalled();
    });
});
