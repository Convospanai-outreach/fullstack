import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAiService } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAiService: {
        getRagEmbedding: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/aiService", () => ({ aiService: mockAiService }));

import { POST } from "./route";

function postWith(body: unknown) {
    return new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("POST /ai/execute - getRagEmbedding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("routes to aiService.getRagEmbedding with the session's own teamId and userId", async () => {
        mockAiService.getRagEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

        const res = await POST(postWith({ action: "getRagEmbedding", text: "hello" }) as any);
        const data = await res.json();

        expect(mockAiService.getRagEmbedding).toHaveBeenCalledWith("hello", "team-1", "user-1");
        expect(data).toEqual({ embedding: [0.1, 0.2, 0.3] });
    });

    it("rejects an empty text", async () => {
        const res = await POST(postWith({ action: "getRagEmbedding", text: "" }) as any);

        expect(res.status).toBe(400);
        expect(mockAiService.getRagEmbedding).not.toHaveBeenCalled();
    });

    it("returns 401 when unauthenticated", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postWith({ action: "getRagEmbedding", text: "hello" }) as any);

        expect(res.status).toBe(401);
        expect(mockAiService.getRagEmbedding).not.toHaveBeenCalled();
    });
});
