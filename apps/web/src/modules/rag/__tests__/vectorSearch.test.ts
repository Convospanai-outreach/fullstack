import { vi } from 'vitest';
import { vectorStore } from "../service/vectorStore";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    prisma: {
        knowledgeItem: {
            create: vi.fn(),
            findMany: vi.fn()
        }
    }
}));

describe("VectorStore Search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return similar documents based on lexical similarity", async () => {
        (prisma.knowledgeItem.findMany as any).mockResolvedValue([
            {
                id: "item-1",
                content: "This is a test document",
                metadata: { source: "kb-1" },
                createdAt: new Date(),
            },
            {
                id: "item-2",
                content: "Completely unrelated topic",
                metadata: { source: "kb-2" },
                createdAt: new Date(),
            },
        ]);

        const results = await vectorStore.search("test query", "team-1");

        expect(results).toHaveLength(1);
        const first = results[0];
        if (!first) throw new Error("Result missing");
        expect(first.content).toBe("This is a test document");
        expect(first.similarity).toBe(0.5);
    });

    it("should return empty if no results found", async () => {
        (prisma.knowledgeItem.findMany as any).mockResolvedValue([]);

        const results = await vectorStore.search("test", "team-1");
        expect(results).toHaveLength(0);
    });
});
