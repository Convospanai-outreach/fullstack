import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { updateMany: vi.fn(), count: vi.fn() },
        campaign: { update: vi.fn() },
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
