import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("@/modules/rag/service/vectorStore", () => ({
    vectorStore: {
        search: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { vectorStore } from "@/modules/rag/service/vectorStore";
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
        expect(vectorStore.search).not.toHaveBeenCalled();
    });

    it("returns empty string when neither company nor campaign context can be resolved", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-1", company: null, campaignId: null });

        const context = await orchestrator.getCampaignContext("", "lead-1");

        expect(context).toBe("");
        expect(vectorStore.search).not.toHaveBeenCalled();
    });

    it("searches across all of the team's knowledge bases (not just one hardcoded KB) with a query synthesized from the lead's company/campaign, and formats the results", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-1", company: "Acme Corp", campaignId: "camp-1" });
        (vectorStore.search as any).mockResolvedValue([
            {
                id: "item-campaign",
                content: "Campaign-matched buyer signal",
                metadata: { campaignId: "campaign-1", companyName: "Acme Corp" },
                similarity: 0.95,
            },
            {
                id: "item-company",
                content: "Company-only signal about Acme",
                metadata: { companyName: "Acme Corp" },
                similarity: 0.5,
            },
        ]);

        const context = await orchestrator.getCampaignContext("campaign-1", "lead-1");

        expect(vectorStore.search).toHaveBeenCalledWith("Acme Corp campaign-1", "team-1", 3);
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
