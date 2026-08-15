import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        knowledgeBase: {
            create: vi.fn(),
            findMany: vi.fn(),
        },
        knowledgeItem: {
            create: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { knowledgeService } from "../knowledgeService";

describe("knowledgeService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createKnowledgeBase", () => {
        it("creates a knowledge base scoped to the team", async () => {
            (prisma.knowledgeBase.create as any).mockResolvedValue({ id: "kb-1", teamId: "team-1", name: "General" });

            const kb = await knowledgeService.createKnowledgeBase("team-1", "General", "desc");

            expect(prisma.knowledgeBase.create).toHaveBeenCalledWith({
                data: { teamId: "team-1", name: "General", description: "desc" },
            });
            expect(kb).toEqual({ id: "kb-1", teamId: "team-1", name: "General" });
        });
    });

    describe("listKnowledgeBases", () => {
        it("lists knowledge bases scoped to the team", async () => {
            (prisma.knowledgeBase.findMany as any).mockResolvedValue([{ id: "kb-1" }]);

            const kbs = await knowledgeService.listKnowledgeBases("team-1");

            expect(prisma.knowledgeBase.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1" },
                orderBy: { createdAt: "desc" },
            });
            expect(kbs).toEqual([{ id: "kb-1" }]);
        });
    });

    describe("addDocument", () => {
        it("creates a knowledge item via the shared vectorStore path", async () => {
            (prisma.knowledgeItem.create as any).mockResolvedValue({ id: "item-1" });

            const result = await knowledgeService.addDocument("kb-1", "some content", { title: "Doc" });

            expect(prisma.knowledgeItem.create).toHaveBeenCalledWith({
                data: { content: "some content", metadata: { title: "Doc" }, knowledgeBaseId: "kb-1" },
            });
            expect(result).toEqual({ success: true, id: "item-1" });
        });
    });

    describe("search", () => {
        it("scopes strictly to knowledgeBaseId, not teamId", async () => {
            (prisma.knowledgeItem.findMany as any).mockResolvedValue([]);

            await knowledgeService.search("kb-1", "pricing");

            expect(prisma.knowledgeItem.findMany).toHaveBeenCalledWith({
                where: { knowledgeBaseId: "kb-1" },
                select: { id: true, content: true, metadata: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 200,
            });
        });

        it("ranks results by lexical token overlap under a 'score' field", async () => {
            (prisma.knowledgeItem.findMany as any).mockResolvedValue([
                { id: "1", content: "our pricing is simple and transparent", metadata: {}, createdAt: new Date() },
                { id: "2", content: "completely unrelated content about weather", metadata: {}, createdAt: new Date() },
                { id: "3", content: "pricing plans and pricing tiers explained", metadata: {}, createdAt: new Date() },
            ]);

            const results = await knowledgeService.search("kb-1", "pricing plans", 5);

            expect(results.map((r) => r.id)).toEqual(["3", "1"]);
            expect(results[0]).toHaveProperty("score");
            expect(results[0]).not.toHaveProperty("similarity");
        });

        it("returns an empty array when query is missing", async () => {
            const results = await knowledgeService.search("kb-1", "");
            expect(results).toEqual([]);
            expect(prisma.knowledgeItem.findMany).not.toHaveBeenCalled();
        });
    });
});
