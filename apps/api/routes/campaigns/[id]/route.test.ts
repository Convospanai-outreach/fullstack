import { describe, expect, it, vi, beforeEach } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
    authorizeRole: vi.fn().mockResolvedValue(undefined),
    TeamRole: { VIEWER: "VIEWER", MEMBER: "MEMBER", ADMIN: "ADMIN" },
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    },
}));

vi.mock("@/lib/campaignService", () => ({
    CampaignService: {
        addLeadsToCampaign: vi.fn().mockResolvedValue(undefined),
        startCampaign: vi.fn(),
        pauseCampaign: vi.fn(),
        getCampaignStats: vi.fn(),
    },
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignService } from "@/lib/campaignService";

function patchRequest(body: unknown) {
    return new Request("http://localhost:3001/api/campaigns/campaign-1", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/campaigns/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (prisma.campaign.findFirst as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a", leadList: [] });
    });

    it("passes the caller's own teamId through to addLeadsToCampaign", async () => {
        const response = await PATCH(
            patchRequest({ leadIds: ["lead-1", "lead-from-team-b"] }),
            { params: Promise.resolve({ id: "campaign-1" }) }
        );

        expect(CampaignService.addLeadsToCampaign).toHaveBeenCalledWith(
            "campaign-1",
            ["lead-1", "lead-from-team-b"],
            "team-a"
        );
        expect(response.status).toBe(200);
    });

    it("returns 404 for a campaign that doesn't belong to the caller's team", async () => {
        (prisma.campaign.findFirst as any).mockResolvedValue(null);

        const response = await PATCH(
            patchRequest({ leadIds: ["lead-1"] }),
            { params: Promise.resolve({ id: "campaign-from-team-b" }) }
        );

        expect(CampaignService.addLeadsToCampaign).not.toHaveBeenCalled();
        expect(response.status).toBe(404);
    });
});
