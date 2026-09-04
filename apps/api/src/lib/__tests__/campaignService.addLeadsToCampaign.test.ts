import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { updateMany: vi.fn(), count: vi.fn() },
        campaign: { update: vi.fn() },
        activity: { create: vi.fn() },
    },
}));

import { prisma } from "@/lib/db";
import { CampaignService } from "../campaignService";

describe("CampaignService.addLeadsToCampaign", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.lead.updateMany as any).mockResolvedValue({ count: 0 });
        (prisma.lead.count as any).mockResolvedValue(0);
        (prisma.campaign.update as any).mockResolvedValue({});
        (prisma.activity.create as any).mockResolvedValue({});
    });

    it("scopes the lead update to the caller's own team, refusing to pull in another team's leads", async () => {
        await CampaignService.addLeadsToCampaign("campaign-1", ["lead-1", "lead-from-team-b"], "team-a");

        expect(prisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["lead-1", "lead-from-team-b"] }, teamId: "team-a" },
            data: { campaignId: "campaign-1" },
        });
    });
});
