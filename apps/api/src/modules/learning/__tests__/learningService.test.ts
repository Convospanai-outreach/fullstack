import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetRagEmbedding } = vi.hoisted(() => ({
    mockGetRagEmbedding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        agentMemory: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
        $queryRawUnsafe: vi.fn(),
        $executeRawUnsafe: vi.fn(),
    },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/aiService", () => ({
    aiService: { getRagEmbedding: mockGetRagEmbedding },
}));

import { prisma } from "@/lib/db";
import { LearningService } from "../learningService";

describe("LearningService.getMemories", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns an empty array when no teamId is given", async () => {
        const memories = await LearningService.getMemories("");
        expect(memories).toEqual([]);
        expect(prisma.agentMemory.findMany).not.toHaveBeenCalled();
    });

    it("queries agentMemory scoped to the team, newest first", async () => {
        (prisma.agentMemory.findMany as any).mockResolvedValue([]);

        await LearningService.getMemories("team-1");

        expect(prisma.agentMemory.findMany).toHaveBeenCalledWith({
            where: { teamId: "team-1" },
            orderBy: { createdAt: "desc" },
        });
    });

    it("formats each memory as 'key: value' strings for prompt consumption", async () => {
        (prisma.agentMemory.findMany as any).mockResolvedValue([
            { id: "1", teamId: "team-1", key: "tone_preference", value: "Always use emojis", confidence: 1 },
            { id: "2", teamId: "team-1", key: "forbidden_phrase", value: "Never mention 'cheap'", confidence: 0.8 },
        ]);

        const memories = await LearningService.getMemories("team-1");

        expect(memories).toEqual([
            "tone_preference: Always use emojis",
            "forbidden_phrase: Never mention 'cheap'",
        ]);
    });

    it("propagates DB failures instead of masking them as 'no memories'", async () => {
        (prisma.agentMemory.findMany as any).mockRejectedValue(new Error("db down"));

        await expect(LearningService.getMemories("team-1")).rejects.toThrow("db down");
    });

    it("with a queryText, returns embedding-ranked memories instead of every row", async () => {
        mockGetRagEmbedding.mockResolvedValue([1, 0, 0]);
        (prisma.$queryRawUnsafe as any).mockResolvedValue([
            { key: "tone_preference", value: "Always use emojis" },
        ]);

        const memories = await LearningService.getMemories("team-1", "Acme Corp pricing objection");

        expect(mockGetRagEmbedding).toHaveBeenCalledWith("Acme Corp pricing objection", "team-1");
        expect(prisma.agentMemory.findMany).not.toHaveBeenCalled();
        expect(memories).toEqual(["tone_preference: Always use emojis"]);
    });

    it("falls back to all-rows when embedding fails even with a queryText", async () => {
        mockGetRagEmbedding.mockRejectedValue(new Error("no key"));
        (prisma.agentMemory.findMany as any).mockResolvedValue([
            { id: "1", teamId: "team-1", key: "tone_preference", value: "Always use emojis" },
        ]);

        const memories = await LearningService.getMemories("team-1", "some query");

        expect(memories).toEqual(["tone_preference: Always use emojis"]);
    });
});

describe("LearningService.saveMemory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates the memory row and best-effort embeds it", async () => {
        (prisma.agentMemory.create as any).mockResolvedValue({ id: "mem-1" });
        mockGetRagEmbedding.mockResolvedValue([0.1, 0.2]);

        const memory = await LearningService.saveMemory("team-1", "tone_preference", "Always use emojis", 0.9);

        expect(prisma.agentMemory.create).toHaveBeenCalledWith({
            data: { teamId: "team-1", key: "tone_preference", value: "Always use emojis", confidence: 0.9 },
        });
        expect(mockGetRagEmbedding).toHaveBeenCalledWith("tone_preference: Always use emojis", "team-1");
        expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
        expect(memory).toEqual({ id: "mem-1" });
    });

    it("still returns the created memory when embedding fails", async () => {
        (prisma.agentMemory.create as any).mockResolvedValue({ id: "mem-1" });
        mockGetRagEmbedding.mockRejectedValue(new Error("no key"));

        const memory = await LearningService.saveMemory("team-1", "tone_preference", "Always use emojis");

        expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
        expect(memory).toEqual({ id: "mem-1" });
    });
});
