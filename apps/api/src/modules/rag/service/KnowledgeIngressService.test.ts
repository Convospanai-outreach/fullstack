import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockToon, mockVectorStore } = vi.hoisted(() => ({
    mockPrisma: {
        campaign: {
            findFirst: vi.fn(),
        },
        knowledgeBase: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
    },
    mockToon: {
        process: vi.fn(),
    },
    mockVectorStore: {
        addDocument: vi.fn(),
        search: vi.fn(),
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/ai/TOON", () => ({
    TOON: mockToon,
}));

vi.mock("./vectorStore", () => ({
    vectorStore: mockVectorStore,
}));

import { KnowledgeIngressService } from "./KnowledgeIngressService";

describe("KnowledgeIngressService tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockToon.process.mockResolvedValue({ optimizedPrompt: "safe text" });
        mockPrisma.knowledgeBase.findFirst.mockResolvedValue({ id: "kb-team-a", teamId: "team-a" });
        mockPrisma.knowledgeBase.create.mockResolvedValue({ id: "kb-team-a", teamId: "team-a" });
        mockVectorStore.search.mockResolvedValue([{ content: "Team A knowledge" }]);
    });

    it("lets Team A write Team A campaign knowledge", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ teamId: "team-a" });

        await KnowledgeIngressService.ingressCampaignKnowledge("campaign-a", "source text", "TEXT", "team-a");

        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-a", teamId: "team-a" },
            select: { teamId: true },
        });
        expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
            "safe text",
            "kb-team-a",
            expect.objectContaining({ campaignId: "campaign-a", source: "source text", type: "TEXT" })
        );
    });

    it("blocks Team A from writing Team B campaign knowledge", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);

        await expect(
            KnowledgeIngressService.ingressCampaignKnowledge("campaign-b", "source text", "TEXT", "team-a")
        ).rejects.toThrow("Campaign not found");

        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-b", teamId: "team-a" },
            select: { teamId: true },
        });
        expect(mockToon.process).not.toHaveBeenCalled();
        expect(mockVectorStore.addDocument).not.toHaveBeenCalled();
    });

    it("lets Team A read Team A campaign knowledge", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ teamId: "team-a" });

        const result = await KnowledgeIngressService.agenticSearch("campaign-a", "pricing", "team-a");

        expect(result).toBe("Team A knowledge");
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-a", teamId: "team-a" },
            select: { teamId: true },
        });
        expect(mockVectorStore.search).toHaveBeenCalledWith("safe text", "team-a", 5);
    });

    it("blocks Team A from reading Team B campaign knowledge", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);

        const result = await KnowledgeIngressService.agenticSearch("campaign-b", "pricing", "team-a");

        expect(result).toBe("");
        expect(mockToon.process).not.toHaveBeenCalled();
        expect(mockVectorStore.search).not.toHaveBeenCalled();
    });

    it("fails closed when internal RAG search lacks team context", async () => {
        const result = await KnowledgeIngressService.agenticSearch("campaign-a", "pricing", "");

        expect(result).toBe("");
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
        expect(mockToon.process).not.toHaveBeenCalled();
        expect(mockVectorStore.search).not.toHaveBeenCalled();
    });
});
