import { vi } from 'vitest';
import { vectorStore } from "../service/vectorStore";
import { prisma } from "@/lib/db";
import { aiService } from "@/modules/ai-content/service/aiService";

vi.mock("@/lib/db", () => ({
    prisma: {
        $queryRawUnsafe: vi.fn(),
        knowledgeBase: {
            findMany: vi.fn()
        },
        knowledgeItem: {
            create: vi.fn(),
            findMany: vi.fn()
        }
    }
}));

vi.mock("@/modules/ai-content/service/aiService", () => ({
    aiService: {
        getEmbeddings: vi.fn()
    }
}));

describe("VectorStore Search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return similar documents based on cosine similarity", async () => {
        const mockQueryEmbedding = [1, 0, 0];
        
        (aiService.getEmbeddings as any).mockResolvedValue(mockQueryEmbedding);
        (prisma.knowledgeItem.findMany as any).mockResolvedValue([
            { id: "item-1", content: "test query matching doc", metadata: null },
            { id: "item-2", content: "low relevance", metadata: null }
        ]);

        const results = await vectorStore.search("test query", "team-1");

        expect(results).toHaveLength(1);
        const first = results[0];
        if (!first) throw new Error("Result missing");
        expect(first.content).toBe("test query matching doc");
        expect(first.similarity).toBe(1);
    });

    it("should return empty if no results found", async () => {
        (aiService.getEmbeddings as any).mockResolvedValue([1, 1, 1]);
        (prisma.knowledgeItem.findMany as any).mockResolvedValue([]);

        const results = await vectorStore.search("test", "team-1");
        expect(results).toHaveLength(0);
    });
});
