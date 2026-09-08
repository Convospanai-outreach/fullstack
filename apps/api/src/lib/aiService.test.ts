import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDeductCredits, mockRefundCredits, mockOpenAICreate } = vi.hoisted(() => ({
    mockPrisma: {
        team: { findUnique: vi.fn() },
        lLMUsageLog: { create: vi.fn().mockResolvedValue({}) },
    },
    mockDeductCredits: vi.fn().mockResolvedValue(true),
    mockRefundCredits: vi.fn().mockResolvedValue(undefined),
    mockOpenAICreate: vi.fn(),
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

import { aiService } from "./aiService";

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
