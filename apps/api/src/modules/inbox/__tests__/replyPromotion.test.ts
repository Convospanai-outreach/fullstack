import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAdvance, mockEnsureQueueEntry, mockWarn } = vi.hoisted(() => ({
    mockAdvance: vi.fn(),
    mockEnsureQueueEntry: vi.fn(),
    mockWarn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { tag: "prisma" } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: mockWarn, error: vi.fn() } }));
vi.mock("@/lib/crm/leadStageTransitions", () => ({ advanceLeadAfterInterestedReply: mockAdvance }));
vi.mock("@/modules/caller/CallerService", () => ({ CallerService: { ensureQueueEntry: mockEnsureQueueEntry } }));

import { promoteLeadOnJudgedReply } from "../replyPromotion";

const base = { leadId: "lead-1", teamId: "team-1" };

describe("promoteLeadOnJudgedReply", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAdvance.mockResolvedValue({ lead: { pipelineState: "HOT" } });
    });

    it.each(["INTERESTED", "QUESTION"])("moves the lead to HOT and queues it for a caller on a confident %s reply", async (classification) => {
        const promoted = await promoteLeadOnJudgedReply({ ...base, classification, confidence: 0.85 });

        expect(promoted).toBe(true);
        expect(mockAdvance).toHaveBeenCalledWith({ tag: "prisma" }, { leadId: "lead-1", teamId: "team-1" });
        expect(mockEnsureQueueEntry).toHaveBeenCalledWith("lead-1", "HOT");
    });

    it("promotes at exactly the confidence bar", async () => {
        expect(await promoteLeadOnJudgedReply({ ...base, classification: "INTERESTED", confidence: 0.7 })).toBe(true);
    });

    it.each([
        ["NOT_INTERESTED", 0.95],
        ["OOO", 1],
        ["DNC", 1],
        ["UNSURE", 0],
        ["INTERESTED", 0.69],
        ["INTERESTED", Number.NaN],
        ["INTERESTED", undefined as unknown as number],
    ])("does nothing for %s at confidence %s", async (classification, confidence) => {
        const promoted = await promoteLeadOnJudgedReply({ ...base, classification, confidence });

        expect(promoted).toBe(false);
        expect(mockAdvance).not.toHaveBeenCalled();
        expect(mockEnsureQueueEntry).not.toHaveBeenCalled();
    });

    it("does not queue a lead that is already further along than HOT", async () => {
        mockAdvance.mockResolvedValue({ lead: { pipelineState: "MEETING_CONFIRMED" } });

        await promoteLeadOnJudgedReply({ ...base, classification: "INTERESTED", confidence: 0.9 });

        expect(mockEnsureQueueEntry).not.toHaveBeenCalled();
    });

    it("does not queue when the lead could not be found", async () => {
        mockAdvance.mockResolvedValue({ lead: null });

        await promoteLeadOnJudgedReply({ ...base, classification: "INTERESTED", confidence: 0.9 });

        expect(mockEnsureQueueEntry).not.toHaveBeenCalled();
    });

    it("never throws when the stage change fails, so the job that stored the classification is not re-run", async () => {
        mockAdvance.mockRejectedValue(new Error("db down"));

        await expect(promoteLeadOnJudgedReply({ ...base, classification: "INTERESTED", confidence: 0.9 })).resolves.toBe(true);
        expect(mockWarn).toHaveBeenCalled();
    });

    it("never throws when queueing for a caller fails", async () => {
        mockEnsureQueueEntry.mockRejectedValue(new Error("queue down"));

        await expect(promoteLeadOnJudgedReply({ ...base, classification: "INTERESTED", confidence: 0.9 })).resolves.toBe(true);
        expect(mockWarn).toHaveBeenCalled();
    });
});
