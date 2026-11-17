import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockSubmit, mockIsDone, mockRead } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findMany: vi.fn() },
        campaign: { findUnique: vi.fn() },
        aiDraftBatch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        aiDraftBatchItem: { createMany: vi.fn(), update: vi.fn() },
    },
    mockSubmit: vi.fn(),
    mockIsDone: vi.fn(),
    mockRead: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/aiService", () => ({
    aiService: { submitMessageBatch: mockSubmit, isMessageBatchDone: mockIsDone, readMessageBatchResults: mockRead },
    extractJsonBlock: (text: string) => text.trim(),
}));

import { submitBatch, pollBatch } from "../batchDraftService";

describe("batchDraftService.submitBatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmit.mockResolvedValue({ providerBatchId: "msgbatch_123", model: "m" });
        mockPrisma.campaign.findUnique.mockResolvedValue({ id: "campaign-1", icp: null });
    });

    it("throws when the campaign has no enriched leads with an email", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([]);

        await expect(submitBatch("campaign-1", "team-1")).rejects.toThrow(
            "No enriched leads with an email found for campaign campaign-1"
        );
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it("hands the prompts to aiService (which meters and applies the input policy), one per lead with customId == leadId", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([
            { id: "lead-1", email: "a@b.com", fullName: "A" },
            { id: "lead-2", email: "b@b.com", fullName: "B" },
        ]);
        mockPrisma.aiDraftBatch.create.mockResolvedValue({ id: "db-batch-1" });

        const result = await submitBatch("campaign-1", "team-1");

        expect(mockSubmit).toHaveBeenCalledTimes(1);
        const [requests, teamId, options] = mockSubmit.mock.calls[0];
        expect(teamId).toBe("team-1");
        expect(options).toMatchObject({ taskType: "EMAIL_DRAFT_BATCH", surface: "EMAIL" });
        expect(requests).toHaveLength(2);
        expect(requests[0]).toMatchObject({ customId: "lead-1" });
        expect(requests[1]).toMatchObject({ customId: "lead-2" });

        expect(mockPrisma.aiDraftBatch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    campaignId: "campaign-1",
                    teamId: "team-1",
                    provider: "anthropic",
                    providerBatchId: "msgbatch_123",
                    itemCount: 2,
                }),
            })
        );
        expect(mockPrisma.aiDraftBatchItem.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [
                    expect.objectContaining({ batchId: "db-batch-1", leadId: "lead-1", customId: "lead-1" }),
                    expect.objectContaining({ batchId: "db-batch-1", leadId: "lead-2", customId: "lead-2" }),
                ],
            })
        );
        expect(result).toEqual({ batchId: "db-batch-1", itemCount: 2 });
    });

    it("saves nothing when aiService refuses the batch (no key, or not enough credits)", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-1", email: "a@b.com" }]);
        mockSubmit.mockRejectedValue(new Error("Insufficient credits for AI generation."));

        await expect(submitBatch("campaign-1", "team-1")).rejects.toThrow("Insufficient credits");
        expect(mockPrisma.aiDraftBatch.create).not.toHaveBeenCalled();
    });

    it("injects stored Crystal personality guidance per lead and 'None' for leads without it", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([
            { id: "lead-1", email: "a@b.com", enrichedData: { crystalKnows: { profileId: "p1", guidance: { prompt: "Be direct and brief." } } } },
            { id: "lead-2", email: "b@b.com", enrichedData: null },
        ]);
        mockPrisma.aiDraftBatch.create.mockResolvedValue({ id: "db-batch-1" });

        await submitBatch("campaign-1", "team-1");

        const requests = mockSubmit.mock.calls[0][0];
        expect(requests[0].prompt).toContain("Personality guidance (DISC):\nBe direct and brief.");
        expect(requests[1].prompt).toContain("Personality guidance (DISC):\nNone");
    });

    it("interpolates the campaign's linked ICP criteria into each prompt", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-1", email: "a@b.com", fullName: "A" }]);
        mockPrisma.campaign.findUnique.mockResolvedValue({
            id: "campaign-1",
            icp: { criteria: { industries: ["SaaS"], personaHook: "loves automation" } },
        });
        mockPrisma.aiDraftBatch.create.mockResolvedValue({ id: "db-batch-1" });

        await submitBatch("campaign-1", "team-1");

        const promptText = mockSubmit.mock.calls[0][0][0].prompt;
        expect(promptText).toContain("loves automation");
        expect(promptText).not.toContain("ICP:\nnull");
    });
});

describe("batchDraftService.pollBatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.aiDraftBatch.findUnique.mockResolvedValue({
            id: "db-batch-1",
            teamId: "team-1",
            providerBatchId: "msgbatch_123",
        });
    });

    it("returns not-ready and bumps pollAttempts while the provider batch is still in progress", async () => {
        mockIsDone.mockResolvedValue(false);

        const result = await pollBatch("db-batch-1");

        expect(result).toEqual({ ready: false });
        expect(mockIsDone).toHaveBeenCalledWith("msgbatch_123", "team-1");
        expect(mockPrisma.aiDraftBatch.update).toHaveBeenCalledWith({
            where: { id: "db-batch-1" },
            data: { status: "polling", pollAttempts: { increment: 1 } },
        });
        expect(mockRead).not.toHaveBeenCalled();
    });

    it("writes each succeeded item's parsed draft and marks the batch completed", async () => {
        mockIsDone.mockResolvedValue(true);
        mockRead.mockResolvedValue([
            { customId: "lead-1", text: '{"subject":"Hi","body":"Hello"}', resultType: "succeeded" },
            { customId: "lead-2", text: null, resultType: "errored" },
        ]);

        const result = await pollBatch("db-batch-1");

        expect(result).toEqual({ ready: true });
        expect(mockRead).toHaveBeenCalledWith("msgbatch_123", "team-1", { taskType: "EMAIL_DRAFT_BATCH" });
        expect(mockPrisma.aiDraftBatchItem.update).toHaveBeenCalledWith({
            where: { customId: "lead-1" },
            data: { status: "succeeded", subject: "Hi", body: "Hello" },
        });
        expect(mockPrisma.aiDraftBatchItem.update).toHaveBeenCalledWith({
            where: { customId: "lead-2" },
            data: { status: "failed", error: "errored" },
        });
        expect(mockPrisma.aiDraftBatch.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "db-batch-1" }, data: expect.objectContaining({ status: "completed" }) })
        );
    });

    it("marks an item failed when its text is not valid JSON", async () => {
        mockIsDone.mockResolvedValue(true);
        mockRead.mockResolvedValue([{ customId: "lead-1", text: "not json", resultType: "succeeded" }]);

        await pollBatch("db-batch-1");

        expect(mockPrisma.aiDraftBatchItem.update).toHaveBeenCalledWith({
            where: { customId: "lead-1" },
            data: { status: "failed", error: expect.stringContaining("Failed to parse draft") },
        });
    });
});
