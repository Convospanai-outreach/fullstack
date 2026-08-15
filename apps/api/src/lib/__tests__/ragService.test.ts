import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        knowledgeItem: {
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { RAGService } from "../ragService";

describe("RAGService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("retrieveContext", () => {
        it("scopes the lookup to the team's knowledge base and joins matching content", async () => {
            (prisma.knowledgeItem.findMany as any).mockResolvedValue([
                { id: "k1", content: "email open rates improve with subject line personalization", metadata: null, createdAt: new Date() },
                { id: "k2", content: "unrelated pricing document", metadata: null, createdAt: new Date() },
            ]);

            const context = await RAGService.retrieveContext("email open rates", "team-1");

            expect(prisma.knowledgeItem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { knowledgeBase: { teamId: "team-1" } },
                })
            );
            expect(context).toContain("email open rates improve with subject line personalization");
            expect(context).not.toContain("unrelated pricing document");
        });

        it("filters out results below minRelevance", async () => {
            (prisma.knowledgeItem.findMany as any).mockResolvedValue([
                { id: "k1", content: "email open rates subject line", metadata: null, createdAt: new Date() },
                { id: "k2", content: "email", metadata: null, createdAt: new Date() },
            ]);

            const context = await RAGService.retrieveContext("email open rates subject line", "team-1", {
                minRelevance: 0.5,
            });

            expect(context).toBe("email open rates subject line");
        });

        it("returns an empty string when nothing in the knowledge base matches", async () => {
            (prisma.knowledgeItem.findMany as any).mockResolvedValue([]);

            const context = await RAGService.retrieveContext("anything", "team-1");

            expect(context).toBe("");
        });
    });

    describe("getRetrievalStats", () => {
        it("computes result count and average similarity from real matches", async () => {
            (prisma.knowledgeItem.findMany as any).mockResolvedValue([
                { id: "k1", content: "email open rates subject line personalization", metadata: null, createdAt: new Date() },
                { id: "k2", content: "email subject", metadata: null, createdAt: new Date() },
            ]);

            const stats = await RAGService.getRetrievalStats("email subject line", "team-1");

            expect(stats.totalResults).toBe(2);
            expect(stats.avgSimilarity).toBeGreaterThan(0);
            expect(stats.avgSimilarity).toBeLessThanOrEqual(1);
        });

        it("returns zero stats when there are no matches", async () => {
            (prisma.knowledgeItem.findMany as any).mockResolvedValue([]);

            const stats = await RAGService.getRetrievalStats("nothing matches", "team-1");

            expect(stats).toEqual({ totalResults: 0, avgSimilarity: 0 });
        });
    });
});
