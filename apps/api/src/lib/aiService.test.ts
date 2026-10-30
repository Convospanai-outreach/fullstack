import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDeductCredits, mockRefundCredits, mockOpenAICreate, mockAnthropicCreate, mockOpenAIEmbeddingsCreate, mockGetCampaignContext, mockGeneratePersonalityPrompt, llmCtorOptions } = vi.hoisted(() => ({
    llmCtorOptions: { openai: undefined as any, anthropic: undefined as any },
    mockPrisma: {
        team: { findUnique: vi.fn() },
        lLMUsageLog: { create: vi.fn().mockResolvedValue({}) },
    },
    mockDeductCredits: vi.fn().mockResolvedValue(true),
    mockRefundCredits: vi.fn().mockResolvedValue(undefined),
    mockOpenAICreate: vi.fn(),
    mockAnthropicCreate: vi.fn(),
    mockOpenAIEmbeddingsCreate: vi.fn(),
    mockGetCampaignContext: vi.fn().mockResolvedValue(""),
    mockGeneratePersonalityPrompt: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({
    deductCredits: mockDeductCredits,
    refundCredits: mockRefundCredits,
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/knowledge/services/knowledgeOrchestrator", () => ({
    KnowledgeOrchestrator: vi.fn(function KnowledgeOrchestrator() {
        return { getCampaignContext: mockGetCampaignContext };
    }),
}));
vi.mock("@/modules/crystal-knows/service/crystalService", () => ({
    CrystalService: { getGuidanceForLead: mockGeneratePersonalityPrompt },
}));
vi.mock("openai", () => ({
    default: class MockOpenAI {
        chat = { completions: { create: mockOpenAICreate } };
        embeddings = { create: mockOpenAIEmbeddingsCreate };
        constructor(options: any) { llmCtorOptions.openai = options; }
    },
}));
vi.mock("@anthropic-ai/sdk", () => ({
    default: class MockAnthropic {
        messages = { create: mockAnthropicCreate };
        constructor(options: any) { llmCtorOptions.anthropic = options; }
    },
}));

import { aiService } from "./aiService";
import { TaskComplexity } from "@/ai/types";

// process.env is unset for GEMINI/ANTHROPIC, so loadTeamProviders resolves
// only the team's configured OpenAI key - no per-provider branching needed.
describe("AIService.generateEmailDraft - TOON serialization (AI cost optimization)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { openai: { apiKey: "test-key", model: "gpt-4o-mini" } } },
        });
    });

    it("serializes lead/ICP data via TOON's compact tabular format, not verbose JSON.stringify", async () => {
        mockOpenAICreate.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ subject: "Hi", body: "Hello there" }) } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
        });

        const lead = { fullName: "Jane Doe", company: "Acme Corp", jobTitle: "VP Sales" };
        const icp = { industries: ["SaaS"], companySize: { min: 50, max: 500 } };

        await aiService.generateEmailDraft(lead, icp, "team-1");

        expect(mockOpenAICreate).toHaveBeenCalled();
        const sentPrompt = mockOpenAICreate.mock.calls[0][0].messages[0].content as string;

        // TOON's object serialization drops JSON's quoted keys and
        // colon-space formatting entirely (e.g. `fullName:Jane Doe` instead
        // of `"fullName": "Jane Doe"`), so the sent prompt must never contain
        // JSON.stringify's characteristic quoted-key shape.
        expect(sentPrompt).toContain("fullName:Jane Doe");
        expect(sentPrompt).not.toContain('"fullName":');
        expect(sentPrompt).not.toContain('"fullName": "Jane Doe"');
    });

    it("grounds the prompt with knowledge base context when the lead has an id", async () => {
        mockGetCampaignContext.mockResolvedValueOnce("- Acme Corp (2026-09-01): expressed pricing interest.");
        mockOpenAICreate.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ subject: "Hi", body: "Hello there" }) } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
        });

        const lead = { id: "lead-1", campaignId: "campaign-1", fullName: "Jane Doe", company: "Acme Corp" };
        await aiService.generateEmailDraft(lead, null, "team-1");

        expect(mockGetCampaignContext).toHaveBeenCalledWith("campaign-1", "lead-1");
        const sentPrompt = mockOpenAICreate.mock.calls[0][0].messages[0].content as string;
        expect(sentPrompt).toContain("expressed pricing interest");
    });

    it("falls back to 'None' when there is no knowledge base context", async () => {
        mockGetCampaignContext.mockResolvedValueOnce("");
        mockOpenAICreate.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ subject: "Hi", body: "Hello there" }) } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
        });

        await aiService.generateEmailDraft({ fullName: "Jane Doe" }, null, "team-1");

        const sentPrompt = mockOpenAICreate.mock.calls[0][0].messages[0].content as string;
        expect(sentPrompt).toContain("Relevant knowledge base context:\nNone");
    });

    it("grounds the prompt with Crystal Knows personality guidance when the lead has a profile id", async () => {
        mockGeneratePersonalityPrompt.mockResolvedValueOnce("Be direct and results-focused; skip small talk.");
        mockOpenAICreate.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ subject: "Hi", body: "Hello there" }) } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
        });

        const lead = { fullName: "Jane Doe", enrichedData: { crystalKnows: { profileId: "profile-1" } } };
        await aiService.generateEmailDraft(lead, null, "team-1");

        expect(mockGeneratePersonalityPrompt).toHaveBeenCalledWith("team-1", lead, "write a cold outreach email");
        const sentPrompt = mockOpenAICreate.mock.calls[0][0].messages[0].content as string;
        expect(sentPrompt).toContain("Be direct and results-focused");
    });

    it("falls back to 'None' for personality guidance when the lead has no Crystal profile", async () => {
        mockGeneratePersonalityPrompt.mockResolvedValueOnce("");
        mockOpenAICreate.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ subject: "Hi", body: "Hello there" }) } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
        });

        await aiService.generateEmailDraft({ fullName: "Jane Doe" }, null, "team-1");

        const sentPrompt = mockOpenAICreate.mock.calls[0][0].messages[0].content as string;
        expect(sentPrompt).toContain("Personality guidance (DISC):\nNone");
    });
});

describe("AIService.askAI - TRIVIAL complexity tier (AI cost optimization)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { anthropic: { apiKey: "test-key" } } },
        });
        mockAnthropicCreate.mockResolvedValue({
            content: [{ type: "text", text: "42" }],
            usage: { input_tokens: 20, output_tokens: 2 },
        });
    });

    it("routes a TRIVIAL-complexity call to the cheap Haiku model, not the default Sonnet strategic model", async () => {
        await aiService.askAI("Score this text 0-100", "team-1", {
            taskType: "ANALYSIS",
            complexity: TaskComplexity.TRIVIAL,
        });

        expect(mockAnthropicCreate).toHaveBeenCalled();
        expect(mockAnthropicCreate.mock.calls[0][0].model).toBe("claude-haiku-5-5");
    });

    it("defaults to the strategic Sonnet model when no complexity is given", async () => {
        await aiService.askAI("Write a creative pitch", "team-1", { taskType: "GENERATION" });

        expect(mockAnthropicCreate).toHaveBeenCalled();
        expect(mockAnthropicCreate.mock.calls[0][0].model).toBe("claude-sonnet-5-5");
    });
});

describe("AIService.askAI - DeepSeek model for every tier", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { deepseek: { apiKey: "test-key" } } },
        });
        mockOpenAICreate.mockResolvedValue({
            choices: [{ message: { content: "ok" } }],
            usage: { prompt_tokens: 10, completion_tokens: 2 },
        });
    });

    it("uses deepseek-chat (Flash, no thinking) even for the default strategic tier, never deepseek-reasoner", async () => {
        for (const complexity of [undefined, TaskComplexity.STRATEGIC, TaskComplexity.ROUTINE, TaskComplexity.TRIVIAL]) {
            await aiService.askAI("Write a short pitch", "team-1", { taskType: "GENERATION", ...(complexity ? { complexity } : {}) });
        }
        expect(mockOpenAICreate).toHaveBeenCalledTimes(4);
        for (const call of mockOpenAICreate.mock.calls) expect(call[0].model).toBe("deepseek-chat");
    });
});

describe("AIService.getRagEmbedding (RAG vector search)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws a clear, catchable error when no OpenAI key is configured for the team", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { anthropic: { apiKey: "test-key" } } },
        });

        await expect(aiService.getRagEmbedding("some text", "team-1")).rejects.toThrow(
            "RAG embeddings require a configured OpenAI API key"
        );
        expect(mockOpenAIEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it("always uses text-embedding-3-small, never the team's configured chat model", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { openai: { apiKey: "test-key", model: "gpt-4o" } } },
        });
        mockOpenAIEmbeddingsCreate.mockResolvedValue({
            data: [{ embedding: [0.1, 0.2, 0.3] }],
            usage: { prompt_tokens: 5 },
        });

        const embedding = await aiService.getRagEmbedding("some text", "team-1");

        expect(mockOpenAIEmbeddingsCreate).toHaveBeenCalledWith(
            expect.objectContaining({ model: "text-embedding-3-small" })
        );
        expect(embedding).toEqual([0.1, 0.2, 0.3]);
    });
});

// Regression for roadmap B-06: LLM SDK clients default to a ~10-minute timeout
// with automatic retries, so a stuck provider call hangs the request handler.
// Assert each client is constructed with an explicit timeout and retry cap.
describe("AIService - LLM client timeouts (B-06)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        llmCtorOptions.openai = undefined;
        llmCtorOptions.anthropic = undefined;
    });

    it("constructs the OpenAI client with a 30s timeout and 1 retry", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { openai: { apiKey: "test-key", model: "gpt-4o-mini" } } },
        });
        mockOpenAICreate.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ subject: "Hi", body: "Hello" }) } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
        });

        await aiService.generateEmailDraft({ fullName: "Jane" }, null, "team-1");

        expect(llmCtorOptions.openai).toMatchObject({ timeout: 30_000, maxRetries: 1 });
    });

    it("constructs the Anthropic client with a 30s timeout and 1 retry", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { anthropic: { apiKey: "test-key", model: "claude-3-5-sonnet" } } },
        });
        mockAnthropicCreate.mockResolvedValue({
            content: [{ type: "text", text: JSON.stringify({ subject: "Hi", body: "Hello" }) }],
            usage: { input_tokens: 10, output_tokens: 5 },
        });

        await aiService.generateEmailDraft({ fullName: "Jane" }, null, "team-1");

        expect(llmCtorOptions.anthropic).toMatchObject({ timeout: 30_000, maxRetries: 1 });
    });
});

// A settlement error after a successful provider call used to land in the provider catch:
// the result was discarded, the next provider was called and the reservation refunded.
describe("AIService - credit settlement failure after a successful generation", () => {
    const BILLED_TEAM = "11111111-1111-4111-8111-111111111111";

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { openai: { apiKey: "test-key", model: "gpt-4o-mini" } } },
        });
        // Reservation succeeds; the usage-adjustment debit hits a DB error.
        mockDeductCredits.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("connection reset"));
    });

    it("returns the generated text, calls the provider once and keeps the reservation", async () => {
        mockOpenAICreate.mockResolvedValue({
            choices: [{ message: { content: "Drafted reply" } }],
            usage: { prompt_tokens: 6000, completion_tokens: 500 },
        });

        const text = await aiService.askAI("Draft a reply", BILLED_TEAM, { taskType: "GENERATION" });

        expect(text).toBe("Drafted reply");
        expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
        expect(mockDeductCredits).toHaveBeenCalledTimes(2);
        expect(mockRefundCredits).not.toHaveBeenCalled();
    });

    it("returns the embedding instead of throwing and refunding", async () => {
        mockOpenAIEmbeddingsCreate.mockResolvedValue({
            data: [{ embedding: [0.1, 0.2] }],
            usage: { prompt_tokens: 6000 },
        });

        await expect(aiService.getRagEmbedding("some text", BILLED_TEAM)).resolves.toEqual([0.1, 0.2]);
        expect(mockRefundCredits).not.toHaveBeenCalled();
    });
});

describe("AIService.askAI - Anthropic drafts that are cut off or empty", () => {
    const longDraft = { subject: "Hi", body: "Hello there, I noticed your team is hiring" };

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { anthropic: { apiKey: "test-key" } } },
        });
    });

    it("leaves room for adaptive thinking: the cap is well above the old 800 tokens", async () => {
        mockAnthropicCreate.mockResolvedValue({
            content: [{ type: "text", text: JSON.stringify(longDraft) }],
            stop_reason: "end_turn",
            usage: { input_tokens: 20, output_tokens: 60 },
        });

        await aiService.askAI("Write a cold email", "team-1", { taskType: "GENERATION" });

        expect(mockAnthropicCreate.mock.calls[0][0].max_tokens).toBeGreaterThanOrEqual(4096);
    });

    it("reads the text block even when a thinking block comes first", async () => {
        mockAnthropicCreate.mockResolvedValue({
            content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(longDraft) }],
            stop_reason: "end_turn",
            usage: { input_tokens: 20, output_tokens: 60 },
        });

        const out = await aiService.askAI("Write a cold email", "team-1", { taskType: "GENERATION", expectsJson: true });

        expect(JSON.parse(out as string)).toEqual(longDraft);
    });

    it("never returns a draft that stopped at max_tokens", async () => {
        mockAnthropicCreate.mockResolvedValue({
            content: [{ type: "text", text: '{"subject":"Hi","body":"Hello there, I noti' }],
            stop_reason: "max_tokens",
            usage: { input_tokens: 20, output_tokens: 4096 },
        });

        await expect(aiService.askAI("Write a cold email", "team-1", { taskType: "GENERATION" })).rejects.toThrow(/cut off/);
    });

    it("never returns an empty draft (thinking used the whole budget, or a refusal)", async () => {
        mockAnthropicCreate.mockResolvedValue({
            content: [{ type: "thinking", thinking: "" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 20, output_tokens: 200 },
        });

        await expect(aiService.askAI("Write a cold email", "team-1", { taskType: "GENERATION" })).rejects.toThrow(/no text/);
    });
});
