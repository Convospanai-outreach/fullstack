import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAiService } = vi.hoisted(() => ({
    mockPrisma: {
        knowledgeItem: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
        knowledgeBase: {
            findUnique: vi.fn(),
        },
        $queryRawUnsafe: vi.fn(),
        $executeRawUnsafe: vi.fn(),
    },
    mockAiService: {
        getRagEmbedding: vi.fn(),
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: mockAiService }));

import { vectorStore } from "../vectorStore";

describe("apps/web vectorStore.search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns real vector-search hits when embedding + query succeed", async () => {
        mockAiService.getRagEmbedding.mockResolvedValue([0.1, 0.2]);
        mockPrisma.$queryRawUnsafe.mockResolvedValue([
            { id: "item-1", content: "Relevant match", metadata: {}, similarity: 0.9 },
        ]);

        const results = await vectorStore.search("query", "team-1", 5);

        expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
        expect(mockPrisma.knowledgeItem.findMany).not.toHaveBeenCalled();
        expect(results).toEqual([{ id: "item-1", content: "Relevant match", metadata: {}, similarity: 0.9 }]);
    });

    it("falls back to lexical search when no OpenAI key is configured", async () => {
        mockAiService.getRagEmbedding.mockRejectedValue(new Error("RAG embeddings require a configured OpenAI API key"));
        mockPrisma.knowledgeItem.findMany.mockResolvedValue([
            { id: "item-1", content: "keyword match content", metadata: {}, createdAt: new Date() },
        ]);

        const results = await vectorStore.search("keyword match", "team-1", 5);

        expect(mockPrisma.knowledgeItem.findMany).toHaveBeenCalled();
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("item-1");
    });

    it("falls back to lexical search when vector search returns zero rows", async () => {
        mockAiService.getRagEmbedding.mockResolvedValue([0.1, 0.2]);
        mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
        mockPrisma.knowledgeItem.findMany.mockResolvedValue([
            { id: "item-2", content: "unembedded keyword content", metadata: {}, createdAt: new Date() },
        ]);

        const results = await vectorStore.search("keyword", "team-1", 5);

        expect(mockPrisma.knowledgeItem.findMany).toHaveBeenCalled();
        expect(results[0].id).toBe("item-2");
    });

    it("returns [] without querying when query or teamId is missing", async () => {
        const results = await vectorStore.search(undefined, "team-1", 5);
        expect(results).toEqual([]);
        expect(mockAiService.getRagEmbedding).not.toHaveBeenCalled();
    });
});

describe("apps/web vectorStore.addDocument", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates the item and best-effort embeds it", async () => {
        mockPrisma.knowledgeItem.create.mockResolvedValue({ id: "item-1" });
        mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ teamId: "team-1" });
        mockAiService.getRagEmbedding.mockResolvedValue([0.1, 0.2]);

        const result = await vectorStore.addDocument("content", "kb-1", {});

        expect(result).toEqual({ success: true, id: "item-1" });
        expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
    });

    it("still succeeds when embedding fails (no key configured)", async () => {
        mockPrisma.knowledgeItem.create.mockResolvedValue({ id: "item-1" });
        mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ teamId: "team-1" });
        mockAiService.getRagEmbedding.mockRejectedValue(new Error("no key"));

        const result = await vectorStore.addDocument("content", "kb-1", {});

        expect(result).toEqual({ success: true, id: "item-1" });
        expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
});
