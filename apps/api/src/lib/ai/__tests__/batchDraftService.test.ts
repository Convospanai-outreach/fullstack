import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockBatchesCreate, mockBatchesRetrieve, mockBatchesResults, mockLoadTeamProviders } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findMany: vi.fn() },
        aiDraftBatch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        aiDraftBatchItem: { createMany: vi.fn(), update: vi.fn() },
    },
    mockBatchesCreate: vi.fn(),
    mockBatchesRetrieve: vi.fn(),
    mockBatchesResults: vi.fn(),
    mockLoadTeamProviders: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/aiService", () => ({
    loadTeamProviders: mockLoadTeamProviders,
    extractJsonBlock: (text: string) => text.trim(),
}));
vi.mock("@anthropic-ai/sdk", () => ({
    default: class MockAnthropic {
        messages = {
            batches: {
                create: mockBatchesCreate,
                retrieve: mockBatchesRetrieve,
                results: mockBatchesResults,
            },
        };
    },
}));

import { submitBatch, pollBatch } from "../batchDraftService";

describe("batchDraftService.submitBatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadTeamProviders.mockResolvedValue({ anthropic: { apiKey: "test-key" } });
    });

    it("throws when the campaign has no enriched leads with an email", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([]);

        await expect(submitBatch("campaign-1", "team-1")).rejects.toThrow(
            "No enriched leads with an email found for campaign campaign-1"
        );
        expect(mockBatchesCreate).not.toHaveBeenCalled();
    });

    it("throws when the team has no Anthropic key configured", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-1", email: "a@b.com" }]);
        mockLoadTeamProviders.mockResolvedValue({});

        await expect(submitBatch("campaign-1", "team-1")).rejects.toThrow(
            "BATCH draft generation requires a configured Anthropic API key"
        );
    });

    it("submits one request per lead with custom_id == leadId, and persists the batch + items", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([
            { id: "lead-1", email: "a@b.com", fullName: "A" },
            { id: "lead-2", email: "b@b.com", fullName: "B" },
        ]);
        mockBatchesCreate.mockResolvedValue({ id: "msgbatch_123" });
        mockPrisma.aiDraftBatch.create.mockResolvedValue({ id: "db-batch-1" });

        const result = await submitBatch("campaign-1", "team-1");

        expect(mockBatchesCreate).toHaveBeenCalledTimes(1);
        const requests = mockBatchesCreate.mock.calls[0][0].requests;
        expect(requests).toHaveLength(2);
        expect(requests[0].custom_id).toBe("lead-1");
        expect(requests[1].custom_id).toBe("lead-2");

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
});

describe("batchDraftService.pollBatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadTeamProviders.mockResolvedValue({ anthropic: { apiKey: "test-key" } });
        mockPrisma.aiDraftBatch.findUnique.mockResolvedValue({
            id: "db-batch-1",
            teamId: "team-1",
            providerBatchId: "msgbatch_123",
        });
    });

    it("returns not-ready and bumps pollAttempts while the provider batch is still in_progress", async () => {
        mockBatchesRetrieve.mockResolvedValue({ processing_status: "in_progress" });

        const result = await pollBatch("db-batch-1");

        expect(result).toEqual({ ready: false });
        expect(mockPrisma.aiDraftBatch.update).toHaveBeenCalledWith({
            where: { id: "db-batch-1" },
            data: { status: "polling", pollAttempts: { increment: 1 } },
        });
        expect(mockBatchesResults).not.toHaveBeenCalled();
    });

    it("writes each succeeded item's parsed draft and marks the batch completed", async () => {
        mockBatchesRetrieve.mockResolvedValue({ processing_status: "ended" });
        mockBatchesResults.mockReturnValue({
            async *[Symbol.asyncIterator]() {
                yield {
                    custom_id: "lead-1",
                    result: {
                        type: "succeeded",
                        message: { content: [{ type: "text", text: '{"subject":"Hi","body":"Hello"}' }] },
                    },
                };
                yield {
                    custom_id: "lead-2",
                    result: { type: "errored", error: { message: "boom" } },
                };
            },
        });

        const result = await pollBatch("db-batch-1");

        expect(result).toEqual({ ready: true });
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
});
