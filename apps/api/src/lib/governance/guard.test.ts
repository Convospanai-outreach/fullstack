import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        organizationPolicy: { findUnique: vi.fn(), create: vi.fn() },
        teamMember: { findFirst: vi.fn() },
        approvalRequest: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { enforcePolicy } from "./guard";

describe("enforcePolicy - CAMPAIGN_RUN approval scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.organizationPolicy.findUnique.mockResolvedValue({
            organizationId: "team-1",
            requiresApprovalForCampaign: true,
            allowInMail: true,
            allowScraping: true,
            allowUploads: true,
        });
        mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: "team-1", userId: "user-1", role: "admin" });
    });

    it("rejects an approvalId that belongs to a different team (cross-tenant bypass)", async () => {
        // Simulates the real query correctly filtering it out - a findFirst scoped by
        // teamId will not return a row belonging to another team.
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);

        await expect(
            enforcePolicy({
                orgId: "team-1",
                userId: "user-1",
                action: "CAMPAIGN_RUN",
                payload: { approvalId: "approval-from-team-2", campaignId: "campaign-1" },
            })
        ).rejects.toThrow("VALID_APPROVAL_REQUIRED");

        expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith({
            where: { id: "approval-from-team-2", teamId: "team-1", entityType: "Campaign", entityId: "campaign-1" },
        });
    });

    it("accepts an approved request scoped to this team and campaign", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({
            id: "approval-1",
            teamId: "team-1",
            entityType: "Campaign",
            entityId: "campaign-1",
            status: "APPROVED",
        });

        await expect(
            enforcePolicy({
                orgId: "team-1",
                userId: "user-1",
                action: "CAMPAIGN_RUN",
                payload: { approvalId: "approval-1", campaignId: "campaign-1" },
            })
        ).resolves.toBe(true);
    });

    it("rejects a pending (not yet approved) request", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({
            id: "approval-1",
            teamId: "team-1",
            entityType: "Campaign",
            entityId: "campaign-1",
            status: "PENDING",
        });

        await expect(
            enforcePolicy({
                orgId: "team-1",
                userId: "user-1",
                action: "CAMPAIGN_RUN",
                payload: { approvalId: "approval-1", campaignId: "campaign-1" },
            })
        ).rejects.toThrow("VALID_APPROVAL_REQUIRED");
    });
});
