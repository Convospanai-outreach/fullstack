import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        campaign: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: { enqueue: vi.fn().mockResolvedValue({ id: "job-1" }) },
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    logWorker: vi.fn(),
}));

vi.mock("@/modules/webhooks/service/webhookService", () => ({
    webhookService: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { executeCampaign } from "../campaign-worker";

describe("campaign-worker executeCampaign", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.campaign.update as any).mockResolvedValue({});
    });

    it("throws when the campaign can't be found", async () => {
        (prisma.campaign.findUnique as any).mockResolvedValue(null);

        await expect(executeCampaign("campaign-1", "user-1", "team-a")).rejects.toThrow(
            "Campaign campaign-1 not found"
        );
    });

    it("refuses to execute a campaign that doesn't belong to the caller's teamId, without activating it", async () => {
        (prisma.campaign.findUnique as any).mockResolvedValue({
            id: "campaign-1",
            teamId: "team-b",
            leadList: [],
        });

        await expect(executeCampaign("campaign-1", "user-1", "team-a")).rejects.toThrow(
            "Campaign campaign-1 does not belong to team team-a"
        );
        expect(prisma.campaign.update).not.toHaveBeenCalled();
        expect(JobQueue.enqueue).not.toHaveBeenCalled();
    });

    it("executes a campaign that belongs to the caller's teamId", async () => {
        (prisma.campaign.findUnique as any).mockResolvedValue({
            id: "campaign-1",
            teamId: "team-a",
            name: "Test Campaign",
            leadList: [{ id: "lead-1" }],
        });

        const result = await executeCampaign("campaign-1", "user-1", "team-a");

        expect(prisma.campaign.update).toHaveBeenCalledWith({
            where: { id: "campaign-1" },
            data: { status: "active" },
        });
        expect(JobQueue.enqueue).toHaveBeenCalled();
        expect(result).toMatchObject({ campaignId: "campaign-1", leadsProcessed: 1 });
    });

    it("executes normally when no teamId is supplied", async () => {
        (prisma.campaign.findUnique as any).mockResolvedValue({
            id: "campaign-1",
            teamId: "team-a",
            name: "Test Campaign",
            leadList: [],
        });

        const result = await executeCampaign("campaign-1", "user-1");

        expect(prisma.campaign.update).toHaveBeenCalled();
        expect(result).toMatchObject({ campaignId: "campaign-1" });
    });
});
