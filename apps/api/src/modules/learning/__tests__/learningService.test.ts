import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        agentMemory: {
            findMany: vi.fn(),
        },
    },
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
});
