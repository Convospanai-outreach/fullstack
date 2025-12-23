import { vectorStore } from "../service/vectorStore";
import { prisma } from "@/lib/db";
import { aiService } from "@/modules/ai-content/service/aiService";

jest.mock("@/lib/db", () => ({
    prisma: {
        knowledgeBase: {
            findMany: jest.fn()
        },
        knowledgeItem: {
            create: jest.fn(),
            findMany: jest.fn()
        }
    }
}));

jest.mock("@/modules/ai-content/service/aiService", () => ({
    aiService: {
        getEmbeddings: jest.fn()
    }
}));

describe("VectorStore Search", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return similar documents based on cosine similarity", async () => {
        const mockQueryEmbedding = [1, 0, 0];
        const mockItemEmbedding = [0.9, 0.1, 0];

        (aiService.getEmbeddings as jest.Mock).mockResolvedValue(mockQueryEmbedding);
        (prisma.knowledgeBase.findMany as jest.Mock).mockResolvedValue([{ id: "kb-1" }]);
        (prisma.knowledgeItem.findMany as jest.Mock).mockResolvedValue([
            { id: "item-1", content: "Matching doc", embedding: mockItemEmbedding },
            { id: "item-2", content: "Irrelevant", embedding: [0, 1, 0] }
        ]);

        const results = await vectorStore.search("test query", "team-1");

        expect(results).toHaveLength(1);
        expect(results[0].content).toBe("Matching doc");
        expect(results[0].score).toBeGreaterThan(0.8);
    });

    it("should return empty if no knowledge bases found", async () => {
        (aiService.getEmbeddings as jest.Mock).mockResolvedValue([1, 1, 1]);
        (prisma.knowledgeBase.findMany as jest.Mock).mockResolvedValue([]);

        const results = await vectorStore.search("test", "team-1");
        expect(results).toHaveLength(0);
    });
});
