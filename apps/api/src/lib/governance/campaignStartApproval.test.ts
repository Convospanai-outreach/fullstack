import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        organizationPolicy: { findUnique: vi.fn() },
        approvalRequest: { findFirst: vi.fn() },
        teamMember: { count: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { campaignStartNeedsApproval, findApprovedCampaignStartId, isBlockedSelfApproval } from "./campaignStartApproval";

describe("campaignStartNeedsApproval", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.organizationPolicy.findUnique.mockResolvedValue({ requiresApprovalForCampaign: true });
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
    });

    it("does not require approval for a team with no policy row", async () => {
        mockPrisma.organizationPolicy.findUnique.mockResolvedValue(null);
        expect(await campaignStartNeedsApproval("team-1", "campaign-1")).toBe(false);
    });

    it("does not require approval when the policy is off", async () => {
        mockPrisma.organizationPolicy.findUnique.mockResolvedValue({ requiresApprovalForCampaign: false });
        expect(await campaignStartNeedsApproval("team-1", "campaign-1")).toBe(false);
        expect(mockPrisma.approvalRequest.findFirst).not.toHaveBeenCalled();
    });

    it("requires approval when the policy is on and none is approved", async () => {
        expect(await campaignStartNeedsApproval("team-1", "campaign-1")).toBe(true);
    });

    it("is satisfied by an approved CAMPAIGN_START request for that campaign", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: "a1" });
        expect(await campaignStartNeedsApproval("team-1", "campaign-1")).toBe(false);
        expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId: "team-1", entityType: "Campaign", entityId: "campaign-1", actionType: "CAMPAIGN_START", status: "APPROVED" },
            }),
        );
    });

    it("fails closed when the policy is on and there is no usable campaignId", async () => {
        expect(await campaignStartNeedsApproval("team-1", undefined)).toBe(true);
        expect(await campaignStartNeedsApproval("team-1", 42)).toBe(true);
    });
});

describe("findApprovedCampaignStartId", () => {
    it("returns null when nothing is approved", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        expect(await findApprovedCampaignStartId("team-1", "campaign-1")).toBeNull();
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
