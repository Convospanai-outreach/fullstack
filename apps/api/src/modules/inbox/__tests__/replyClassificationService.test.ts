import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockEnqueue, mockAnalyze } = vi.hoisted(() => ({
    mockDb: {
        lead: { findUnique: vi.fn() },
        message: { findFirst: vi.fn(), count: vi.fn() },
        replyTracker: { findFirst: vi.fn(), findMany: vi.fn() },
        teamMember: { findMany: vi.fn() },
        emailEvent: { findUnique: vi.fn() },
    },
    mockEnqueue: vi.fn(),
    mockAnalyze: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/ai/agents/ReplyAnalyzerAgent", () => ({ ReplyAnalyzerAgent: { analyzeAndTrack: mockAnalyze } }));
vi.mock("@/lib/notifications", () => ({ NotificationDispatcher: { send: vi.fn() } }));

import { classifyInboundReply, enqueueReplyClassification } from "../replyClassificationService";
import { getSuggestionsForReplies, suggestedOutcomeFor } from "../replySuggestions";
import { onInboundReply } from "../inboundReplyNotifier";

describe("suggestedOutcomeFor (the one vocabulary mapping)", () => {
    it.each([
        ["INTERESTED", "interested", false],
        ["NOT_INTERESTED", "not_interested", false],
        ["DNC", "not_interested", true],
        ["OOO", null, false],
        ["QUESTION", null, false],
        ["SOMETHING_ELSE", null, false],
    ])("%s -> outcome %s, askedNotToContact %s", (classification, outcome, askedNotToContact) => {
        expect(suggestedOutcomeFor(classification)).toEqual({ outcome, askedNotToContact });
    });
});

describe("enqueueReplyClassification", () => {
    beforeEach(() => vi.clearAllMocks());

    it("queues one job per inbound message, keyed for idempotency and tagged with the lead's team", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: "team-a" });

        await enqueueReplyClassification({ id: "msg-1", leadId: "lead-1" });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "reply_classification",
            { messageId: "msg-1", teamId: "team-a" },
            { teamId: "team-a", idempotencyKey: "reply_classification_msg-1" }
        );
    });

    it("does nothing for a lead without a team", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: null });
        await enqueueReplyClassification({ id: "msg-1", leadId: "lead-1" });
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("never throws when the queue fails", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: "team-a" });
        mockEnqueue.mockRejectedValueOnce(new Error("db down"));
        await expect(enqueueReplyClassification({ id: "msg-1", leadId: "lead-1" })).resolves.toBeUndefined();
    });
});

describe("ingestion hook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.lead.findUnique.mockResolvedValue({ fullName: "A", email: "a@x.test", teamId: "team-a" });
        mockDb.message.count.mockResolvedValue(1); // alert deduped, so only classification is exercised
    });

    it("onInboundReply still resolves when classification enqueueing throws", async () => {
        mockEnqueue.mockRejectedValue(new Error("queue exploded"));
        const reply = { id: "msg-1", leadId: "lead-1", createdAt: new Date() };

        await expect(onInboundReply(reply)).resolves.toBeUndefined();
        expect(mockEnqueue).toHaveBeenCalled();
    });
});

describe("classifyInboundReply", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.replyTracker.findFirst.mockResolvedValue(null);
        mockAnalyze.mockResolvedValue({ classification: "INTERESTED" });
    });

    const message = {
        id: "msg-1",
        leadId: "lead-1",
        content: "<p>Sounds great, let's talk</p>",
        lead: { email: "asha@acme.test" },
        emailEvent: { email: { subject: "Re: hello" } },
    };

    it("classifies a team's inbound reply, passing the team and message id through", async () => {
        mockDb.message.findFirst.mockResolvedValue(message);

        const result = await classifyInboundReply("team-a", "msg-1");

        expect(mockDb.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "msg-1", direction: "INBOUND", lead: { teamId: "team-a" } },
        }));
        expect(mockAnalyze).toHaveBeenCalledWith("Re: hello", "Sounds great, let's talk", "lead-1", "asha@acme.test", "msg-1", "team-a");
        expect(result).toEqual({ classification: "INTERESTED" });
    });

    it("never classifies a message whose lead is in another team", async () => {
        mockDb.message.findFirst.mockResolvedValue(null); // the team-scoped query finds nothing

        const result = await classifyInboundReply("team-b", "msg-1");

        expect(result).toEqual({ skipped: "not_found" });
        expect(mockDb.message.findFirst.mock.calls[0][0].where.lead).toEqual({ teamId: "team-b" });
        expect(mockAnalyze).not.toHaveBeenCalled();
    });

    it("does not classify the same message twice (no second AI call)", async () => {
        mockDb.message.findFirst.mockResolvedValue(message);
        mockDb.replyTracker.findFirst.mockResolvedValue({ id: "rt-1" });

        const result = await classifyInboundReply("team-a", "msg-1");

        expect(mockDb.replyTracker.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { emailId: "msg-1", lead: { teamId: "team-a" } } }));
        expect(result).toEqual({ skipped: "already_classified" });
        expect(mockAnalyze).not.toHaveBeenCalled();
    });
});

describe("getSuggestionsForReplies", () => {
    beforeEach(() => vi.clearAllMocks());

    it("reads only the team's rows, and a foreign team's rows never come back", async () => {
        mockDb.replyTracker.findMany.mockResolvedValue([]); // DB applies lead.teamId; foreign rows are filtered out

        const result = await getSuggestionsForReplies("team-a", ["msg-1"]);

        expect(mockDb.replyTracker.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { emailId: { in: ["msg-1"] }, status: "PENDING_REVIEW", lead: { teamId: "team-a" } } }));
        expect(result.size).toBe(0);
    });

    it("skips the query for an empty page", async () => {
        await getSuggestionsForReplies("team-a", []);
        expect(mockDb.replyTracker.findMany).not.toHaveBeenCalled();
    });

    it("maps OOO and QUESTION to a label with no outcome", async () => {
        mockDb.replyTracker.findMany.mockResolvedValue([
            { emailId: "m1", aiClassification: "OOO", aiConfidence: 0.9, aiReasoning: null, replyDraft: null },
            { emailId: "m2", aiClassification: "QUESTION", aiConfidence: 0.7, aiReasoning: "asks", replyDraft: "Sure" },
        ]);
        const result = await getSuggestionsForReplies("team-a", ["m1", "m2"]);
        expect(result.get("m1")).toMatchObject({ classification: "OOO", suggestedOutcome: null });
        expect(result.get("m2")).toMatchObject({ classification: "QUESTION", suggestedOutcome: null, suggestedReply: "Sure" });
    });
});
