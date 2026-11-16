import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: { $executeRawUnsafe: vi.fn(), $queryRawUnsafe: vi.fn(), lLMCache: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/aiService", () => ({ aiService: { getEmbeddings: vi.fn() } }));

import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { SemanticCache } from "../SemanticCache";

describe("SemanticCache", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("does not send a malformed embedding to the database when caching", async () => {
        (aiService.getEmbeddings as any).mockResolvedValue([0.1, Number.NaN]);
        await new SemanticCache().set("team-a", "prompt", "response", 1, 1);
        expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it("stores a well-formed embedding", async () => {
        (aiService.getEmbeddings as any).mockResolvedValue(Array(1536).fill(0.5));
        await new SemanticCache().set("team-a", "prompt", "response", 1, 1);
        expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });

    describe("tenant scoping", () => {
        const embedding = Array(1536).fill(0.5);
        beforeEach(() => {
            (aiService.getEmbeddings as any).mockResolvedValue(embedding);
            (prisma.lLMCache.findUnique as any).mockResolvedValue(null);
            (prisma.$queryRawUnsafe as any).mockResolvedValue([]);
        });

        it("tenant B cannot read tenant A's cached output from memory", async () => {
            const cache = new SemanticCache();
            await cache.set("team-a", "same prompt", "A's private answer", 1, 1);
            expect(await cache.getExact("team-a", "same prompt")).toBe("A's private answer");
            expect(await cache.getExact("team-b", "same prompt")).toBeNull();
            expect(await cache.get("team-b", "same prompt")).toBeNull();
        });

        it("keys the stored row by team: the same prompt hashes differently per team", async () => {
            const cache = new SemanticCache();
            await cache.getExact("team-a", "same prompt");
            await cache.getExact("team-b", "same prompt");
            const [a, b] = (prisma.lLMCache.findUnique as any).mock.calls.map((c: any) => c[0].where.promptHash);
            expect(a).not.toEqual(b);
        });

        it("writes the team on the row", async () => {
            await new SemanticCache().set("team-a", "p", "r", 1, 2);
            const [sql, ...values] = (prisma.$executeRawUnsafe as any).mock.calls[0];
            expect(sql).toContain('"teamId"');
            expect(values).toContain("team-a");
        });

        it("only searches this team's rows semantically", async () => {
            await new SemanticCache().get("team-a", "p");
            const [sql, ...values] = (prisma.$queryRawUnsafe as any).mock.calls[0];
            expect(sql).toMatch(/"teamId"\s*=\s*\$3/);
            expect(values[2]).toBe("team-a");
        });

        it("refuses to run without a team", async () => {
            const cache = new SemanticCache();
            expect(await cache.getExact("", "p")).toBeNull();
            expect(await cache.get("", "p")).toBeNull();
            await cache.set("", "p", "r", 1, 1);
            expect(prisma.lLMCache.findUnique).not.toHaveBeenCalled();
            expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
        });
    });
});
