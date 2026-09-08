import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockJobQueueEnqueue, mockSubmitBatch, mockPollBatch } = vi.hoisted(() => ({
    mockPrisma: {
        aiDraftBatch: { findUnique: vi.fn() },
        aiDraftBatchItem: { findMany: vi.fn() },
    },
    mockJobQueueEnqueue: vi.fn(),
    mockSubmitBatch: vi.fn(),
    mockPollBatch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/queue", async () => {
    const actual = await vi.importActual<any>("@/lib/queue");
    return { ...actual, JobQueue: { enqueue: mockJobQueueEnqueue } };
});
vi.mock("@/lib/ai/batchDraftService", () => ({
    submitBatch: mockSubmitBatch,
    pollBatch: mockPollBatch,
}));

import { handleEmailDraftBatchSubmit, handleEmailDraftBatchPoll } from "../emailDraftBatchHandlers";

describe("handleEmailDraftBatchSubmit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("submits the batch and enqueues the first poll", async () => {
        mockSubmitBatch.mockResolvedValue({ batchId: "db-batch-1", itemCount: 2 });

        const result = await handleEmailDraftBatchSubmit({ campaignId: "campaign-1", teamId: "team-1" } as any);

        expect(mockSubmitBatch).toHaveBeenCalledWith("campaign-1", "team-1");
        expect(mockJobQueueEnqueue).toHaveBeenCalledWith(
            "EMAIL_DRAFT_BATCH_POLL",
            { campaignId: "campaign-1", teamId: "team-1", batchId: "db-batch-1" },
            expect.objectContaining({ teamId: "team-1" })
        );
        expect(result).toEqual({ batchId: "db-batch-1" });
    });
});

describe("handleEmailDraftBatchPoll", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reschedules itself with backoff when the batch is not ready yet", async () => {
        mockPollBatch.mockResolvedValue({ ready: false });
        mockPrisma.aiDraftBatch.findUnique.mockResolvedValue({ pollAttempts: 0 });

        const result = await handleEmailDraftBatchPoll({
            campaignId: "campaign-1",
            teamId: "team-1",
            batchId: "db-batch-1",
        } as any);

        expect(mockJobQueueEnqueue).toHaveBeenCalledWith(
            "EMAIL_DRAFT_BATCH_POLL",
            { campaignId: "campaign-1", teamId: "team-1", batchId: "db-batch-1" },
            expect.objectContaining({ teamId: "team-1" })
        );
        expect(result).toMatchObject({ deferred: true });
    });

    it("gives up after exceeding the max poll attempts", async () => {
        mockPollBatch.mockResolvedValue({ ready: false });
        mockPrisma.aiDraftBatch.findUnique.mockResolvedValue({ pollAttempts: 4 });

        await expect(
            handleEmailDraftBatchPoll({ campaignId: "campaign-1", teamId: "team-1", batchId: "db-batch-1" } as any)
        ).rejects.toThrow("did not complete within the polling window");
    });

    it("enqueues an email_sending job per item once ready, with precomputedDraft only for succeeded items", async () => {
        mockPollBatch.mockResolvedValue({ ready: true });
        mockPrisma.aiDraftBatchItem.findMany.mockResolvedValue([
            { leadId: "lead-1", status: "succeeded", subject: "Hi", body: "Hello" },
            { leadId: "lead-2", status: "failed", subject: null, body: null },
        ]);

        const result = await handleEmailDraftBatchPoll({
            campaignId: "campaign-1",
            teamId: "team-1",
            batchId: "db-batch-1",
        } as any);

        expect(mockJobQueueEnqueue).toHaveBeenCalledWith(
            "email_sending",
            expect.objectContaining({ leadId: "lead-1", precomputedDraft: { subject: "Hi", body: "Hello" } }),
            expect.objectContaining({ idempotencyKey: "batch_send_db-batch-1_lead-1" })
        );
        expect(mockJobQueueEnqueue).toHaveBeenCalledWith(
            "email_sending",
            expect.not.objectContaining({ precomputedDraft: expect.anything() }),
            expect.objectContaining({ idempotencyKey: "batch_send_db-batch-1_lead-2" })
        );
        expect(result).toEqual({ batchId: "db-batch-1", itemsProcessed: 2 });
    });
});
