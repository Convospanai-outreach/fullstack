import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { updateMany: vi.fn(), count: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
        campaign: { update: vi.fn(), findUnique: vi.fn().mockResolvedValue({ icpId: null }) },
        iCP: { findUnique: vi.fn() },
        activity: { create: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/sequenceService", () => ({ SequenceService: { startSequence: vi.fn() } }));

import { CampaignService } from "./campaignService";

describe("CampaignService.addLeadsToCampaign - cross-tenant scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    it("scopes the lead update to the caller's teamId, not just the lead IDs", async () => {
        mockPrisma.lead.count.mockResolvedValue(2);
        mockPrisma.campaign.update.mockResolvedValue({});
        mockPrisma.activity.create.mockResolvedValue({});

        await CampaignService.addLeadsToCampaign("campaign-1", ["lead-a", "lead-from-other-team"], "team-1");

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["lead-a", "lead-from-other-team"] }, teamId: "team-1" },
            data: { campaignId: "campaign-1" },
        });
    });
});

describe("CampaignService.addLeadsToCampaign - ICP fit scoring", () => {
    beforeEach(() => vi.clearAllMocks());

    it("scores each attached lead against the campaign's ICP and persists icpFitScore", async () => {
        mockPrisma.campaign.findUnique.mockResolvedValue({ icpId: "icp-1" });
        mockPrisma.iCP.findUnique.mockResolvedValue({ criteria: { jobTitles: ["VP Sales"] } });
        mockPrisma.lead.findMany.mockResolvedValue([
            { id: "lead-a", jobTitle: "VP Sales", enrichedData: null },
        ]);
        mockPrisma.lead.count.mockResolvedValue(1);
        mockPrisma.campaign.update.mockResolvedValue({});
        mockPrisma.activity.create.mockResolvedValue({});

        await CampaignService.addLeadsToCampaign("campaign-1", ["lead-a"], "team-1");

        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-a" },
            data: { campaignId: "campaign-1", icpFitScore: expect.any(Number) },
        });
        expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    });
});
