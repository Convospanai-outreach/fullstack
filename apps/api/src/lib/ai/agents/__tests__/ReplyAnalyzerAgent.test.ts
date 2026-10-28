import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAskAI, mockClassifyReply, mockPrisma, mockGetGuidanceForLead, mockSaveMemory } = vi.hoisted(() => ({
    mockSaveMemory: vi.fn(),
    mockAskAI: vi.fn(),
    mockClassifyReply: vi.fn(),
    mockPrisma: {
        lead: { findFirst: vi.fn(), update: vi.fn() },
        replyTracker: { create: vi.fn() },
    },
    mockGetGuidanceForLead: vi.fn(),
}));

vi.mock("@/lib/aiService", () => ({ aiService: { askAI: mockAskAI } }));
vi.mock("@/lib/ai/jev", () => ({ classifyReply: mockClassifyReply }));
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
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";

const classified = (classification: string, confidence = 0.8) => ({ classification, confidence, reasoning: "r" });

describe("ReplyAnalyzerAgent personality guidance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClassifyReply.mockResolvedValue(classified("QUESTION"));
        mockAskAI.mockResolvedValue("Hi");
    });

    it("injects the lead's stored guidance into the draft prompt, scoped to the lead's team", async () => {
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

describe("ReplyAnalyzerAgent classification and draft", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.lead.findFirst.mockResolvedValue({ teamId: "team-1", enrichedData: null });
        mockGetGuidanceForLead.mockResolvedValue("");
        mockAskAI.mockResolvedValue("Hi");
    });

    it("classifies the masked reply with Jev for the lead's team", async () => {
        mockClassifyReply.mockResolvedValue(classified("NOT_INTERESTED", 0.9));
        const result = await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "No thanks", "lead-1", "a@b.com", "msg-1", "team-1");

        expect(mockClassifyReply).toHaveBeenCalledWith({ subject: "Re: hi", body: "No thanks" }, "team-1");
        expect(result).toMatchObject({ classification: "NOT_INTERESTED", confidence: 0.9, suggestedAction: "PAUSE_CAMPAIGN" });
    });

    it("asks for local masking to be applied when the Edge Node is down", async () => {
        mockClassifyReply.mockResolvedValue(classified("NOT_INTERESTED", 0.9));
        await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "mail me at a@b.com", "lead-1", "a@b.com", "msg-1", "team-1");

        const calls = vi.mocked(SovereignFirewall.mask).mock.calls;
        expect(calls).toHaveLength(2);
        for (const call of calls) expect(call[3]).toEqual({ alwaysMask: true });
    });

    it.each([
        ["INTERESTED", "SCHEDULE_MEETING"],
        ["QUESTION", "SENT_REPLY"],
    ])("drafts a response for %s, billed to the lead's team", async (classification, action) => {
        mockClassifyReply.mockResolvedValue(classified(classification));
        const result = await ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "lead-1", "a@b.com", "msg-1", "team-1");

        expect(result).toMatchObject({ suggestedAction: action, draftResponse: "Hi" });
        expect(mockAskAI).toHaveBeenCalledTimes(1);
        expect(mockAskAI.mock.calls[0][1]).toBe("team-1");
    });

    it.each(["NOT_INTERESTED", "OOO", "DNC"])("makes no LLM call and stores no draft for %s", async (classification) => {
        mockClassifyReply.mockResolvedValue(classified(classification));
        const result = await ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "lead-1", "a@b.com", "msg-1", "team-1");

        expect(result.draftResponse).toBeUndefined();
        expect(mockAskAI).not.toHaveBeenCalled();
        expect(mockPrisma.replyTracker.create.mock.calls[0][0].data.replyDraft).toBeNull();
    });
});

describe("ReplyAnalyzerAgent is classify-and-store only", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.lead.findFirst.mockResolvedValue({ teamId: "team-1", enrichedData: null });
        mockGetGuidanceForLead.mockResolvedValue("");
        mockAskAI.mockResolvedValue("Hi");
    });

    it.each(["DNC", "OOO", "INTERESTED"])("a high-confidence %s changes no lead, writes no memory, and stays PENDING_REVIEW", async (classification) => {
        mockClassifyReply.mockResolvedValue(classified(classification, 0.99));

        const result = await ReplyAnalyzerAgent.analyzeAndTrack("Re: hi", "stop emailing me", "lead-1", "a@b.com", "msg-1", "team-1");

        expect(result.classification).toBe(classification);
        expect(mockPrisma.lead.update).not.toHaveBeenCalled();
        expect(mockSaveMemory).not.toHaveBeenCalled();
        expect(mockPrisma.replyTracker.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ leadId: "lead-1", emailId: "msg-1", aiClassification: classification, aiConfidence: 0.99, aiReasoning: "r", status: "PENDING_REVIEW" }),
        });
        expect(mockPrisma.replyTracker.create.mock.calls[0][0].data).not.toHaveProperty("actionTaken");
    });

    it("refuses a lead outside the team before any AI call or write", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);

        await expect(ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "foreign-lead", "a@b.com", "msg-1", "team-1")).rejects.toThrow("Lead not found");
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign-lead", teamId: "team-1" } }));
        expect(mockClassifyReply).not.toHaveBeenCalled();
        expect(mockAskAI).not.toHaveBeenCalled();
        expect(mockPrisma.replyTracker.create).not.toHaveBeenCalled();
    });

    it("stores nothing when the classification or the draft fails", async () => {
        mockClassifyReply.mockRejectedValueOnce(new Error("jev down"));
        await expect(ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "lead-1", "a@b.com", "msg-1", "team-1")).rejects.toThrow("jev down");

        mockClassifyReply.mockResolvedValueOnce(classified("QUESTION"));
        mockAskAI.mockRejectedValueOnce(new Error("provider down"));
        await expect(ReplyAnalyzerAgent.analyzeAndTrack("s", "b", "lead-1", "a@b.com", "msg-1", "team-1")).rejects.toThrow("provider down");
        expect(mockPrisma.replyTracker.create).not.toHaveBeenCalled();
    });
});
