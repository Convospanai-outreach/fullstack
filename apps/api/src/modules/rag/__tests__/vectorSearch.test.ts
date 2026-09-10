import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetRagEmbedding } = vi.hoisted(() => ({
    mockPrisma: {
        $queryRawUnsafe: vi.fn(),
        $executeRawUnsafe: vi.fn(),
        knowledgeBase: { findUnique: vi.fn() },
        knowledgeItem: { create: vi.fn(), findMany: vi.fn() },
    },
    mockGetRagEmbedding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/aiService", () => ({
    aiService: { getRagEmbedding: mockGetRagEmbedding },
}));

import { vectorStore } from "../service/vectorStore";

describe("vectorStore.search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns embedding-ranked results when a vector search hits", async () => {
        mockGetRagEmbedding.mockResolvedValue([1, 0, 0]);
        mockPrisma.$queryRawUnsafe.mockResolvedValue([
            { id: "item-1", content: "vector match", metadata: null, similarity: 0.98 },
        ]);

        const results = await vectorStore.search("test query", "team-1");

        expect(mockGetRagEmbedding).toHaveBeenCalledWith("test query", "team-1");
        expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
        expect(mockPrisma.knowledgeItem.findMany).not.toHaveBeenCalled();
        expect(results).toEqual([{ id: "item-1", content: "vector match", metadata: null, similarity: 0.98 }]);
    });

    it("falls back to lexical search when no OpenAI key is configured for RAG", async () => {
        mockGetRagEmbedding.mockRejectedValue(new Error("RAG embeddings require a configured OpenAI API key"));
        mockPrisma.knowledgeItem.findMany.mockResolvedValue([
            { id: "item-1", content: "test query matching doc", metadata: null },
            { id: "item-2", content: "unrelated content", metadata: null },
        ]);

        const results = await vectorStore.search("test query", "team-1");

        expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
        expect(results).toHaveLength(1);
        expect(results[0].content).toBe("test query matching doc");
    });

    it("falls back to lexical search when the vector query returns zero rows (nothing embedded yet)", async () => {
        mockGetRagEmbedding.mockResolvedValue([1, 0, 0]);
        mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
        mockPrisma.knowledgeItem.findMany.mockResolvedValue([
            { id: "item-1", content: "test query matching doc", metadata: null },
        ]);

        const results = await vectorStore.search("test query", "team-1");

        expect(results).toHaveLength(1);
        expect(results[0].content).toBe("test query matching doc");
    });

    it("returns empty when neither query nor teamId is given", async () => {
        expect(await vectorStore.search(undefined, "team-1")).toEqual([]);
        expect(await vectorStore.search("q", undefined)).toEqual([]);
    });
});

describe("vectorStore.addDocument", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates the item and best-effort embeds it", async () => {
        mockPrisma.knowledgeItem.create.mockResolvedValue({ id: "item-1" });
        mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ teamId: "team-1" });
        mockGetRagEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

        const result = await vectorStore.addDocument("hello world", "kb-1", { source: "test" });

        expect(mockPrisma.knowledgeItem.create).toHaveBeenCalledWith({
            data: { content: "hello world", metadata: { source: "test" }, knowledgeBaseId: "kb-1" },
        });
        expect(mockGetRagEmbedding).toHaveBeenCalledWith("hello world", "team-1");
        expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
        expect(result).toEqual({ success: true, id: "item-1" });
    });

    it("still succeeds (item created) when embedding fails", async () => {
        mockPrisma.knowledgeItem.create.mockResolvedValue({ id: "item-1" });
        mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ teamId: "team-1" });
        mockGetRagEmbedding.mockRejectedValue(new Error("no key"));

        const result = await vectorStore.addDocument("hello world", "kb-1");

        expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
        expect(result).toEqual({ success: true, id: "item-1" });
    });
});
