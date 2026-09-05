import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockAuth, mockInboxService, mockAiService, mockLearningService } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findFirst: vi.fn() },
    },
    mockAuth: {
        getCurrentContext: vi.fn(),
    },
    mockInboxService: {
        getMessages: vi.fn(),
    },
    mockAiService: {
        generateSmartReply: vi.fn(),
    },
    mockLearningService: {
        getMemories: vi.fn(),
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockAuth.getCurrentContext }));
vi.mock("@/lib/inboxService", () => ({ InboxService: mockInboxService }));
vi.mock("@/lib/aiService", () => ({ aiService: mockAiService }));
vi.mock("@/modules/learning/learningService", () => ({ LearningService: mockLearningService }));

function postRequest(body: unknown) {
    return new NextRequest("http://localhost/api/inbox/suggest", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("POST /api/inbox/suggest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLearningService.getMemories.mockResolvedValue([]);
    });

    it("returns 401 if unauthenticated", async () => {
        mockAuth.getCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { POST } = await import("./route");

        const res = await POST(postRequest({ leadId: "lead-1" }));

        expect(res.status).toBe(401);
        expect(mockInboxService.getMessages).not.toHaveBeenCalled();
    });

    it("never reads another team's message content (404 before getMessages)", async () => {
        mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        const { POST } = await import("./route");

        const res = await POST(postRequest({ leadId: "lead-foreign" }));

        expect(res.status).toBe(404);
        expect(mockInboxService.getMessages).not.toHaveBeenCalled();
    });

    it("reads messages only after confirming the lead belongs to the caller's team", async () => {
        mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
        mockPrisma.lead.findFirst.mockResolvedValue({ teamId: "team-alpha" });
        mockInboxService.getMessages.mockResolvedValue([{ sender: "them", content: "hi" }]);
        mockAiService.generateSmartReply.mockResolvedValue(["Hi there!"]);
        const { POST } = await import("./route");

        const res = await POST(postRequest({ leadId: "lead-1" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-alpha" },
            select: { teamId: true },
        });
        expect(mockInboxService.getMessages).toHaveBeenCalledWith("lead-1");
    });
});
