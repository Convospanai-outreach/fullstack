import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDeductCredits, mockRefundCredits, mockOpenAICreate, mockAnthropicCreate } = vi.hoisted(() => ({
    mockPrisma: {
        team: { findUnique: vi.fn() },
        lLMUsageLog: { create: vi.fn().mockResolvedValue({}) },
    },
    mockDeductCredits: vi.fn().mockResolvedValue(true),
    mockRefundCredits: vi.fn().mockResolvedValue(undefined),
    mockOpenAICreate: vi.fn(),
    mockAnthropicCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({
    deductCredits: mockDeductCredits,
    refundCredits: mockRefundCredits,
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("openai", () => ({
    default: class MockOpenAI {
        chat = { completions: { create: mockOpenAICreate } };
    },
}));
vi.mock("@anthropic-ai/sdk", () => ({
    default: class MockAnthropic {
        messages = { create: mockAnthropicCreate };
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
        expect(mockAnthropicCreate.mock.calls[0][0].model).toBe("claude-3-5-haiku");
    });

    it("defaults to the strategic Sonnet model when no complexity is given", async () => {
        await aiService.askAI("Write a creative pitch", "team-1", { taskType: "GENERATION" });

        expect(mockAnthropicCreate).toHaveBeenCalled();
        expect(mockAnthropicCreate.mock.calls[0][0].model).toBe("claude-3-5-sonnet");
    });
});
