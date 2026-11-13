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
        await new SemanticCache().set("prompt", "response", 1, 1);
        expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it("stores a well-formed embedding", async () => {
        (aiService.getEmbeddings as any).mockResolvedValue(Array(1536).fill(0.5));
        await new SemanticCache().set("prompt", "response", 1, 1);
        expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });
});
