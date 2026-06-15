import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAnswer } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAnswer: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: mockGetCurrentContext
}));

vi.mock("@/services/basicAnswerService", () => ({
    basicAnswerService: {
        answer: mockAnswer
    }
}));

describe("/api/assistant/answer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAnswer.mockResolvedValue({
            answer: "AI fallback answer",
            source: "llm",
            confidence: 64,
            usedLLM: true
        });
    });

    it("rejects unauthenticated requests", async () => {
        mockGetCurrentContext.mockResolvedValue({ teamId: null });
        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/api/assistant/answer", {
            method: "POST",
            body: JSON.stringify({ question: "How do I sync leads?" })
        }) as any);

        expect(response.status).toBe(401);
        expect(mockAnswer).not.toHaveBeenCalled();
    });

    it("returns a structured answer for the authenticated team", async () => {
        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/api/assistant/answer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                question: "How do I sync LinkedIn leads?",
                teamId: "team-1",
                context: "crm"
            })
        }) as any);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({ source: "llm", usedLLM: true });
        expect(mockAnswer).toHaveBeenCalledWith({
            question: "How do I sync LinkedIn leads?",
            teamId: "team-1",
            context: "crm"
        });
    });

    it("rejects cross-team requests", async () => {
        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/api/assistant/answer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                question: "How do I sync LinkedIn leads?",
                teamId: "other-team"
            })
        }) as any);

        expect(response.status).toBe(401);
        expect(mockAnswer).not.toHaveBeenCalled();
    });
});
