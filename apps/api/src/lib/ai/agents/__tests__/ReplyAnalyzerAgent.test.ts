import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAskAI, mockPrisma, mockGetGuidanceForLead } = vi.hoisted(() => ({
    mockAskAI: vi.fn(),
    mockPrisma: {
        lead: { findUnique: vi.fn(), update: vi.fn() },
        replyTracker: { create: vi.fn() },
    },
    mockGetGuidanceForLead: vi.fn(),
}));

vi.mock("@/lib/aiService", () => ({ aiService: { askAI: mockAskAI } }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/ai/SovereignFirewall", () => ({
    SovereignFirewall: {
        mask: vi.fn(async (text: string) => ({ safeContext: text, tokenMap: new Map() })),
        unmaskAsync: vi.fn(async (text: string) => text),
    },
}));
vi.mock("@/modules/learning/learningService", () => ({ LearningService: { saveMemory: vi.fn() } }));
vi.mock("@/modules/crystal-knows/service/crystalService", () => ({
    CrystalService: { getGuidanceForLead: mockGetGuidanceForLead },
}));

import { ReplyAnalyzerAgent } from "../ReplyAnalyzerAgent";

describe("ReplyAnalyzerAgent personality guidance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAskAI.mockResolvedValue(
            JSON.stringify({ classification: "QUESTION", confidence: 0.8, reasoning: "r", suggestedAction: "SENT_REPLY", draftResponse: "Hi" })
        );
    });

    it("injects the lead's stored guidance, scoped to the lead's team", async () => {
        const lead = { teamId: "team-1", enrichedData: { crystalKnows: { guidance: { prompt: "Be direct." } } } };
        mockPrisma.lead.findUnique.mockResolvedValue(lead);
        mockGetGuidanceForLead.mockResolvedValue("Be direct.");

        await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "How does it work?", "lead-1", "a@b.com");

        expect(mockGetGuidanceForLead).toHaveBeenCalledWith("team-1", lead, expect.any(String));
        expect(mockAskAI.mock.calls[0][0]).toContain("PERSONALITY GUIDANCE (DISC)");
        expect(mockAskAI.mock.calls[0][0]).toContain("Be direct.");
    });

    it("omits the section when there is no guidance, and still drafts if the lookup throws", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ teamId: "team-1", enrichedData: null });
        mockGetGuidanceForLead.mockResolvedValueOnce("");
        await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "Q?", "lead-1", "a@b.com");
        expect(mockAskAI.mock.calls[0][0]).not.toContain("PERSONALITY GUIDANCE");

        mockGetGuidanceForLead.mockRejectedValueOnce(new Error("boom"));
        const result = await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "Q?", "lead-1", "a@b.com");
        expect(result.classification).toBe("QUESTION");
        expect(mockAskAI.mock.calls[1][0]).not.toContain("PERSONALITY GUIDANCE");
    });
});
