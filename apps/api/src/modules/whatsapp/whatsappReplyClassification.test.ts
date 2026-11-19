import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockEnqueue, mockMask, mockMaskNames, mockClassify, mockPromote, mockOptOut } = vi.hoisted(() => ({
    mockDb: {
        lead: { findUnique: vi.fn() },
        whatsAppMessage: { findFirst: vi.fn() },
    },
    mockEnqueue: vi.fn(),
    mockMask: vi.fn(),
    mockMaskNames: vi.fn(),
    mockClassify: vi.fn(),
    mockPromote: vi.fn(),
    mockOptOut: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/ai/SovereignFirewall", () => ({ SovereignFirewall: { mask: mockMask, maskKnownNames: mockMaskNames } }));
vi.mock("@/lib/ai/jev", () => ({ classifyReply: mockClassify }));
vi.mock("@/modules/inbox/replyPromotion", () => ({ promoteLeadOnJudgedReply: mockPromote }));
vi.mock("@/modules/inbox/replyOptOut", () => ({ enforceOptOutOnJudgedReply: mockOptOut }));

import { classifyWhatsAppReply, enqueueWhatsAppReplyClassification } from "./whatsappReplyClassification";

describe("enqueueWhatsAppReplyClassification", () => {
    beforeEach(() => vi.clearAllMocks());

    it("queues one job per inbound message, keyed for idempotency and tagged with the lead's team", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: "team-a" });

        await enqueueWhatsAppReplyClassification({ id: "wa-1", leadId: "lead-1" });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "whatsapp_reply_classification",
            { messageId: "wa-1", teamId: "team-a" },
            { teamId: "team-a", idempotencyKey: "whatsapp_reply_classification_wa-1" }
        );
    });

    it("does nothing for a lead without a team", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: null });

        await enqueueWhatsAppReplyClassification({ id: "wa-1", leadId: "lead-1" });

        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("never throws when the queue fails", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: "team-a" });
        mockEnqueue.mockRejectedValue(new Error("queue down"));

        await expect(enqueueWhatsAppReplyClassification({ id: "wa-1", leadId: "lead-1" })).resolves.toBeUndefined();
    });
});

describe("classifyWhatsAppReply", () => {
    const message = { id: "wa-1", leadId: "lead-1", body: "Yes please call me on +91 98765 43210", lead: { fullName: "Asha Rao", company: "Acme" } };

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.whatsAppMessage.findFirst.mockResolvedValue(message);
        mockMask.mockResolvedValue({ safeContext: "Yes please call me on [PHONE_1]", tokenMap: new Map() });
        mockMaskNames.mockReturnValue({ safeContext: "Yes please call me on [PHONE_1]" });
        mockClassify.mockResolvedValue({ classification: "INTERESTED", confidence: 0.9, reasoning: "" });
        mockOptOut.mockResolvedValue(false);
    });

    it("only reads an inbound message that belongs to the team", async () => {
        mockDb.whatsAppMessage.findFirst.mockResolvedValue(null);

        const result = await classifyWhatsAppReply("team-b", "wa-1");

        expect(result).toEqual({ skipped: "not_found" });
        expect(mockDb.whatsAppMessage.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "wa-1", direction: "INBOUND", lead: { teamId: "team-b" } },
        }));
        expect(mockClassify).not.toHaveBeenCalled();
        expect(mockPromote).not.toHaveBeenCalled();
    });

    it("sends only masked text to the classifier, with no subject", async () => {
        await classifyWhatsAppReply("team-a", "wa-1");

        expect(mockMask).toHaveBeenCalledWith(message.body, "GLOBAL", undefined, { alwaysMask: true });
        expect(mockMaskNames).toHaveBeenCalledWith("Yes please call me on [PHONE_1]", { person: "Asha Rao", company: "Acme" }, expect.any(Map));
        expect(mockClassify).toHaveBeenCalledWith({ subject: "", body: "Yes please call me on [PHONE_1]" }, "team-a");
        expect(JSON.stringify(mockClassify.mock.calls)).not.toContain("98765");
    });

    it("promotes the lead with the classification and confidence it got", async () => {
        const result = await classifyWhatsAppReply("team-a", "wa-1");

        expect(mockPromote).toHaveBeenCalledWith({ leadId: "lead-1", teamId: "team-a", classification: "INTERESTED", confidence: 0.9 });
        expect(result).toEqual({ classification: "INTERESTED" });
    });

    it("hands the classification to the opt-out step for the WhatsApp channel", async () => {
        mockClassify.mockResolvedValue({ classification: "DNC", confidence: 0.95, reasoning: "" });

        await classifyWhatsAppReply("team-a", "wa-1");

        expect(mockOptOut).toHaveBeenCalledWith({ leadId: "lead-1", classification: "DNC", confidence: 0.95, channel: "WHATSAPP" });
    });

    it("fails the job when the opt-out cannot be enforced, so it is retried, and does not promote", async () => {
        mockClassify.mockResolvedValue({ classification: "DNC", confidence: 1, reasoning: "" });
        mockOptOut.mockRejectedValue(new Error("db down"));

        await expect(classifyWhatsAppReply("team-a", "wa-1")).rejects.toThrow("db down");
        expect(mockPromote).not.toHaveBeenCalled();
    });

    it("lets a classifier failure fail the job so it retries", async () => {
        mockClassify.mockRejectedValue(new Error("JEV_API_KEY is not set"));

        await expect(classifyWhatsAppReply("team-a", "wa-1")).rejects.toThrow("JEV_API_KEY");
        expect(mockPromote).not.toHaveBeenCalled();
    });
});
