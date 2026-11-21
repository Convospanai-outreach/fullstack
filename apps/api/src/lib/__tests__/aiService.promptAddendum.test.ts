import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockOpenAICreate } = vi.hoisted(() => ({
    mockPrisma: {
        team: { findUnique: vi.fn() },
        lLMUsageLog: { create: vi.fn().mockResolvedValue({}) },
        manualReview: { create: vi.fn().mockResolvedValue({}) }
    },
    mockOpenAICreate: vi.fn()
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({ deductCredits: vi.fn().mockResolvedValue(true), refundCredits: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("openai", () => ({
    default: class MockOpenAI {
        chat = { completions: { create: mockOpenAICreate } };
    }
}));

import { aiService, withPromptAddendum } from "../aiService";

const TEAM = "3f1c2a4e-8b7d-4c1a-9e2f-1a2b3c4d5e6f";
const ADDENDUM = "Write like a person texting a colleague.";
const sent = () => JSON.stringify(mockOpenAICreate.mock.calls.at(-1)![0]);
const draft = () => aiService.askAI("Write a short note", TEAM, { taskType: "EMAIL_DRAFT", surface: "EMAIL", disableGuardrails: true });
const critique = () => aiService.askAI("Review this note", TEAM, { taskType: "CRITIQUE", surface: "EMAIL", disableGuardrails: true });

describe("withPromptAddendum", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.team.findUnique.mockResolvedValue({ aiConfig: { providers: { openai: { apiKey: "team-openai" } } } });
        mockOpenAICreate.mockResolvedValue({ choices: [{ message: { content: "A plain note." } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    });

    it("adds the rules to a draft-generation call inside it", async () => {
        await withPromptAddendum(ADDENDUM, draft);
        expect(sent()).toContain(ADDENDUM);
    });

    it("leaves the critic and every other task alone", async () => {
        await withPromptAddendum(ADDENDUM, critique);
        expect(sent()).not.toContain(ADDENDUM);
    });

    it("changes nothing outside it", async () => {
        await draft();
        expect(sent()).not.toContain(ADDENDUM);
    });

    it("keeps concurrent addenda apart", async () => {
        await Promise.all([withPromptAddendum("RULES-ONE", draft), withPromptAddendum("RULES-TWO", draft)]);
        const bodies = mockOpenAICreate.mock.calls.map((c) => JSON.stringify(c[0]));
        expect(bodies.filter((b) => b.includes("RULES-ONE") && !b.includes("RULES-TWO"))).toHaveLength(1);
        expect(bodies.filter((b) => b.includes("RULES-TWO") && !b.includes("RULES-ONE"))).toHaveLength(1);
    });
});
