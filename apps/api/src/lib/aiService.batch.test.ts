import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDeductCredits, mockRefundCredits, mockBatchesCreate, mockBatchesRetrieve, mockBatchesResults } = vi.hoisted(() => ({
    mockPrisma: {
        team: { findUnique: vi.fn() },
        lLMUsageLog: { create: vi.fn().mockResolvedValue({}) },
    },
    mockDeductCredits: vi.fn().mockResolvedValue(true),
    mockRefundCredits: vi.fn().mockResolvedValue(undefined),
    mockBatchesCreate: vi.fn(),
    mockBatchesRetrieve: vi.fn(),
    mockBatchesResults: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({ deductCredits: mockDeductCredits, refundCredits: mockRefundCredits }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/knowledge/services/knowledgeOrchestrator", () => ({
    KnowledgeOrchestrator: vi.fn(function KnowledgeOrchestrator() {
        return { getCampaignContext: vi.fn().mockResolvedValue("") };
    }),
}));
vi.mock("@/modules/crystal-knows/service/crystalService", () => ({
    CrystalService: { getGuidanceForLead: vi.fn().mockResolvedValue(null) },
}));
vi.mock("@anthropic-ai/sdk", () => ({
    default: class MockAnthropic {
        messages = { create: vi.fn(), batches: { create: mockBatchesCreate, retrieve: mockBatchesRetrieve, results: mockBatchesResults } };
    },
}));

import { aiService } from "./aiService";

// A real team id is a uuid; the credit code only charges those.
const TEAM = "6f1d2c4e-1111-4222-8333-444455556666";

beforeEach(() => {
    vi.clearAllMocks();
    mockDeductCredits.mockResolvedValue(true);
    mockPrisma.lLMUsageLog.create.mockResolvedValue({});
    mockPrisma.team.findUnique.mockResolvedValue({ aiConfig: { providers: { anthropic: { apiKey: "test-key", model: "claude-test" } } } });
});

describe("AIService.submitMessageBatch", () => {
    it("reserves credits, submits one request per prompt with its custom id, and returns the provider batch id", async () => {
        mockBatchesCreate.mockResolvedValue({ id: "msgbatch_1" });

        const result = await aiService.submitMessageBatch(
            [{ customId: "lead-1", prompt: "Write one." }, { customId: "lead-2", prompt: "Write two." }],
            TEAM,
            { taskType: "EMAIL_DRAFT_BATCH", maxTokens: 800 }
        );

        expect(result).toEqual({ providerBatchId: "msgbatch_1", model: "claude-test" });
        expect(mockDeductCredits).toHaveBeenCalledTimes(1);
        expect(mockDeductCredits.mock.calls[0][0]).toBe(TEAM);
        expect(mockDeductCredits.mock.calls[0][1]).toBeGreaterThanOrEqual(2);
        const requests = mockBatchesCreate.mock.calls[0][0].requests;
        expect(requests.map((r: any) => r.custom_id)).toEqual(["lead-1", "lead-2"]);
        expect(requests[0].params).toMatchObject({ model: "claude-test", max_tokens: 800 });
    });

    it("sends nothing when the team cannot pay for the batch", async () => {
        mockDeductCredits.mockResolvedValue(false);

        await expect(
            aiService.submitMessageBatch([{ customId: "lead-1", prompt: "Write one." }], TEAM, { taskType: "EMAIL_DRAFT_BATCH" })
        ).rejects.toThrow("Insufficient credits");
        expect(mockBatchesCreate).not.toHaveBeenCalled();
    });

    it("returns the reserved credits when the provider does not accept the batch", async () => {
        mockBatchesCreate.mockRejectedValue(new Error("provider down"));

        await expect(
            aiService.submitMessageBatch([{ customId: "lead-1", prompt: "Write one." }], TEAM, { taskType: "EMAIL_DRAFT_BATCH" })
        ).rejects.toThrow("provider down");

        const reserved = mockDeductCredits.mock.calls[0][1];
        expect(mockRefundCredits).toHaveBeenCalledWith(TEAM, reserved, expect.stringContaining("failure rollback"), expect.anything());
    });

    it("requires an Anthropic key before reserving anything", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ aiConfig: {} });

        await expect(
            aiService.submitMessageBatch([{ customId: "lead-1", prompt: "Write one." }], TEAM, { taskType: "EMAIL_DRAFT_BATCH" })
        ).rejects.toThrow("Anthropic API key");
        expect(mockDeductCredits).not.toHaveBeenCalled();
    });
});

describe("AIService.isMessageBatchDone / readMessageBatchResults", () => {
    it("is done only once the provider reports the batch ended", async () => {
        mockBatchesRetrieve.mockResolvedValueOnce({ processing_status: "in_progress" }).mockResolvedValueOnce({ processing_status: "ended" });

        expect(await aiService.isMessageBatchDone("msgbatch_1", TEAM)).toBe(false);
        expect(await aiService.isMessageBatchDone("msgbatch_1", TEAM)).toBe(true);
    });

    it("returns each result's text and logs usage for succeeded and failed requests", async () => {
        mockBatchesResults.mockResolvedValue({
            async *[Symbol.asyncIterator]() {
                yield {
                    custom_id: "lead-1",
                    result: { type: "succeeded", message: { model: "claude-test", content: [{ type: "text", text: "hello" }], usage: { input_tokens: 120, output_tokens: 40 } } },
                };
                yield { custom_id: "lead-2", result: { type: "errored", error: { message: "boom" } } };
            },
        });

        const out = await aiService.readMessageBatchResults("msgbatch_1", TEAM, { taskType: "EMAIL_DRAFT_BATCH" });

        expect(out).toEqual([
            { customId: "lead-1", text: "hello", resultType: "succeeded" },
            { customId: "lead-2", text: null, resultType: "errored" },
        ]);
        expect(mockPrisma.lLMUsageLog.create).toHaveBeenCalledTimes(2);
        expect(mockPrisma.lLMUsageLog.create.mock.calls[0][0].data).toMatchObject({ teamId: TEAM, provider: "anthropic", taskType: "EMAIL_DRAFT_BATCH", tokensIn: 120, tokensOut: 40, success: true });
        expect(mockPrisma.lLMUsageLog.create.mock.calls[1][0].data).toMatchObject({ success: false, error: "errored" });
    });
});
