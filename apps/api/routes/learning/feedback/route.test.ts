import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        message: { findFirst: vi.fn() },
        agentFeedback: { create: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

function postRequest(body: unknown) {
    return new Request("http://localhost/learning/feedback", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /learning/feedback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects a caller with no team context", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: null });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ messageId: "msg-1", rating: 5 }) as any);

        expect(response.status).toBe(401);
        expect(mockPrisma.message.findFirst).not.toHaveBeenCalled();
    });

    it("rejects feedback for a message belonging to another team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.message.findFirst.mockResolvedValue(null);
        const { POST } = await import("./route");

        const response = await POST(postRequest({ messageId: "other-teams-message", rating: 1 }) as any);

        expect(response.status).toBe(404);
        expect(mockPrisma.message.findFirst).toHaveBeenCalledWith({
            where: { id: "other-teams-message", lead: { teamId: "team-1" } },
        });
        expect(mockPrisma.agentFeedback.create).not.toHaveBeenCalled();
    });

    it("records feedback for a message belonging to the caller's own team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.message.findFirst.mockResolvedValue({ id: "own-message" });
        mockPrisma.agentFeedback.create.mockResolvedValue({ id: "feedback-1" });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ messageId: "own-message", rating: 5, comment: "great" }) as any);

        expect(response.status).toBe(200);
        expect(mockPrisma.agentFeedback.create).toHaveBeenCalledWith({
            data: { messageId: "own-message", userId: "user-1", rating: 5, comment: "great" },
        });
    });
});
