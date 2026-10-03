import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAskAI, mockPrisma, mockGetGuidanceForLead, mockSaveMemory } = vi.hoisted(() => ({
    mockSaveMemory: vi.fn(),
    mockAskAI: vi.fn(),
    mockPrisma: {
        lead: { findFirst: vi.fn(), update: vi.fn() },
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
vi.mock("@/modules/learning/learningService", () => ({ LearningService: { saveMemory: mockSaveMemory } }));
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
        mockPrisma.lead.findFirst.mockResolvedValue(lead);
        mockGetGuidanceForLead.mockResolvedValue("Be direct.");

        await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "How does it work?", "lead-1", "a@b.com", "msg-1", "team-1");

        expect(mockGetGuidanceForLead).toHaveBeenCalledWith("team-1", lead, expect.any(String));
        expect(mockAskAI.mock.calls[0][0]).toContain("PERSONALITY GUIDANCE (DISC)");
        expect(mockAskAI.mock.calls[0][0]).toContain("Be direct.");
    });

    it("omits the section when there is no guidance, and still drafts if the lookup throws", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ teamId: "team-1", enrichedData: null });
        mockGetGuidanceForLead.mockResolvedValueOnce("");
        await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "Q?", "lead-1", "a@b.com", "msg-1", "team-1");
        expect(mockAskAI.mock.calls[0][0]).not.toContain("PERSONALITY GUIDANCE");

        mockGetGuidanceForLead.mockRejectedValueOnce(new Error("boom"));
        const result = await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "Q?", "lead-1", "a@b.com", "msg-1", "team-1");
        expect(result.classification).toBe("QUESTION");
        expect(mockAskAI.mock.calls[1][0]).not.toContain("PERSONALITY GUIDANCE");
    });
});

describe("ReplyAnalyzerAgent is classify-and-store only", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.lead.findFirst.mockResolvedValue({ teamId: "team-1", enrichedData: null });
        mockGetGuidanceForLead.mockResolvedValue("");
    });

    it.each(["DNC", "OOO", "INTERESTED"])("a high-confidence %s changes no lead, writes no memory, and stays PENDING_REVIEW", async (classification) => {
        mockAskAI.mockResolvedValue(
            JSON.stringify({ classification, confidence: 0.99, reasoning: "r", suggestedAction: "BLACKLIST", draftResponse: "Hi" })
        );

        const result = await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "stop emailing me", "lead-1", "a@b.com", "msg-1", "team-1");

        expect(result.classification).toBe(classification);
        expect(mockPrisma.lead.update).not.toHaveBeenCalled();
        expect(mockSaveMemory).not.toHaveBeenCalled();
        expect(mockPrisma.replyTracker.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ leadId: "lead-1", emailId: "msg-1", aiClassification: classification, status: "PENDING_REVIEW", replyDraft: "Hi" }),
        });
        expect(mockPrisma.replyTracker.create.mock.calls[0][0].data).not.toHaveProperty("actionTaken");
    });

    it("bills the call to the lead's team", async () => {
        mockAskAI.mockResolvedValue(JSON.stringify({ classification: "QUESTION", confidence: 0.8, reasoning: "r", suggestedAction: "SENT_REPLY" }));
        await ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "lead-1", "a@b.com", "msg-1", "team-1");
        expect(mockAskAI.mock.calls[0][1]).toBe("team-1");
    });

    it("refuses a lead outside the team before any AI call or write", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);

        await expect(ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "foreign-lead", "a@b.com", "msg-1", "team-1")).rejects.toThrow("Lead not found");
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign-lead", teamId: "team-1" } }));
        expect(mockAskAI).not.toHaveBeenCalled();
        expect(mockPrisma.replyTracker.create).not.toHaveBeenCalled();
    });

    it("stores nothing when the AI call or its output fails", async () => {
        mockAskAI.mockRejectedValueOnce(new Error("provider down"));
        await expect(ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "lead-1", "a@b.com", "msg-1", "team-1")).rejects.toThrow("provider down");

        mockAskAI.mockResolvedValueOnce(JSON.stringify({ classification: "BANANA", confidence: 0.9 }));
        await expect(ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "lead-1", "a@b.com", "msg-1", "team-1")).rejects.toThrow();
        expect(mockPrisma.replyTracker.create).not.toHaveBeenCalled();
    });
});
