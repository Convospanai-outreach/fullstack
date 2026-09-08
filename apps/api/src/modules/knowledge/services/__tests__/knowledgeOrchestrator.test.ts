import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
        },
        knowledgeBase: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("@/modules/knowledge/knowledgeService", () => ({
    knowledgeService: {
        search: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { knowledgeService } from "@/modules/knowledge/knowledgeService";
import { KnowledgeOrchestrator } from "../knowledgeOrchestrator";

describe("KnowledgeOrchestrator.getCampaignContext", () => {
    let orchestrator: KnowledgeOrchestrator;

    beforeEach(() => {
        vi.clearAllMocks();
        orchestrator = new KnowledgeOrchestrator();
    });

    it("returns empty string when leadId is missing (team scope can't be derived)", async () => {
        const context = await orchestrator.getCampaignContext("campaign-1", "");
        expect(context).toBe("");
        expect(prisma.lead.findUnique).not.toHaveBeenCalled();
    });

    it("returns empty string when the lead has no teamId", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: null, company: null, campaignId: null });

        const context = await orchestrator.getCampaignContext("campaign-1", "lead-1");

        expect(context).toBe("");
        expect(prisma.knowledgeBase.findFirst).not.toHaveBeenCalled();
    });

    it("returns empty string when the team has no 'Netjana Intelligence' knowledge base", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-1", company: "Acme", campaignId: null });
        (prisma.knowledgeBase.findFirst as any).mockResolvedValue(null);

        const context = await orchestrator.getCampaignContext("campaign-1", "lead-1");

        expect(prisma.knowledgeBase.findFirst).toHaveBeenCalledWith({
            where: { teamId: "team-1", name: "Netjana Intelligence" },
            select: { id: true },
        });
        expect(context).toBe("");
    });

    it("searches the team's 'Netjana Intelligence' KB with a query synthesized from the lead's company/campaign, and formats the results", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-1", company: "Acme Corp", campaignId: "camp-1" });
        (prisma.knowledgeBase.findFirst as any).mockResolvedValue({ id: "kb-1" });
        (knowledgeService.search as any).mockResolvedValue([
            {
                id: "item-campaign",
                content: "Campaign-matched buyer signal",
                metadata: { campaignId: "campaign-1", companyName: "Acme Corp" },
                score: 0.95,
            },
            {
                id: "item-company",
                content: "Company-only signal about Acme",
                metadata: { companyName: "Acme Corp" },
                score: 0.5,
            },
        ]);

        const context = await orchestrator.getCampaignContext("campaign-1", "lead-1");

        expect(knowledgeService.search).toHaveBeenCalledWith("kb-1", "Acme Corp campaign-1", 3, "team-1");
        const lines = context.split("\n");
        expect(lines[0]).toContain("Campaign-matched buyer signal");
        expect(lines[1]).toContain("Company-only signal about Acme");
    });

    it("swallows errors and returns empty string", async () => {
        (prisma.lead.findUnique as any).mockRejectedValue(new Error("db down"));

        const context = await orchestrator.getCampaignContext("campaign-1", "lead-1");

        expect(context).toBe("");
    });
});
