import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/runtime-control/dispatchService", () => ({
    resolveRuntimeEndpoint: vi.fn().mockResolvedValue({ mode: "LOCAL" }),
}));

import { aiService } from "../aiService";

describe("apps/web aiService.getRagEmbedding", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(global, "fetch" as any);
    });

    it("proxies to /ai/execute with the getRagEmbedding action", async () => {
        fetchSpy.mockResolvedValue({
            ok: true,
            json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
        } as any);

        const embedding = await aiService.getRagEmbedding("hello");

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining("/ai/execute"),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ action: "getRagEmbedding", text: "hello", teamId: undefined }),
            })
        );
        expect(embedding).toEqual([0.1, 0.2, 0.3]);
    });
});
