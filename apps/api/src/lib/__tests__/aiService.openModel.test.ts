import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDeductCredits, mockOpenAICreate, ctor } = vi.hoisted(() => ({
    ctor: { openai: [] as any[] },
    mockPrisma: {
        team: { findUnique: vi.fn() },
        lLMUsageLog: { create: vi.fn().mockResolvedValue({}) },
        manualReview: { create: vi.fn().mockResolvedValue({}) }
    },
    mockDeductCredits: vi.fn().mockResolvedValue(true),
    mockOpenAICreate: vi.fn()
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({ deductCredits: mockDeductCredits, refundCredits: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("openai", () => ({
    default: class MockOpenAI {
        chat = { completions: { create: mockOpenAICreate } };
        constructor(options: any) { ctor.openai.push(options); }
    }
}));

import { aiService } from "../aiService";
import { TaskComplexity } from "@/ai/types";

const TEAM = "3f1c2a4e-8b7d-4c1a-9e2f-1a2b3c4d5e6f"; // aiService bills only real (uuid) team ids
const ENV = { OPEN_MODEL_API_KEY: "open-key", OPEN_MODEL_BASE_URL: "https://open.example/v1", OPEN_MODEL_SMALL: "small-m", OPEN_MODEL_LARGE: "large-m" };

describe("aiService open-weight model (preferOpenModel)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ctor.openai = [];
        Object.assign(process.env, ENV);
        mockPrisma.team.findUnique.mockResolvedValue({ aiConfig: { providers: { openai: { apiKey: "team-openai", model: "gpt-4o-mini" } } } });
        mockOpenAICreate.mockResolvedValue({ choices: [{ message: { content: "Nice point about weekly releases." } }], usage: { prompt_tokens: 40, completion_tokens: 10 } });
    });
    afterEach(() => { for (const k of Object.keys(ENV)) delete process.env[k]; });

    it("calls the open model host first, large model for routine work", async () => {
        await aiService.askAI("Write a comment", TEAM, { preferOpenModel: true, complexity: TaskComplexity.ROUTINE, disableGuardrails: true });
        expect(ctor.openai[0]).toMatchObject({ apiKey: "open-key", baseURL: "https://open.example/v1" });
        expect(mockOpenAICreate.mock.calls[0][0].model).toBe("large-m");
        expect(mockDeductCredits).toHaveBeenCalled(); // a team call is billed as usual
    });

    it("uses the small model for trivial screening, and bills nothing without a team", async () => {
        await aiService.askAI("Is this a lead?", undefined, { preferOpenModel: true, complexity: TaskComplexity.TRIVIAL, expectsJson: true });
        expect(mockOpenAICreate.mock.calls[0][0].model).toBe("small-m");
        expect(mockDeductCredits).not.toHaveBeenCalled();
    });

    it("leaves every other caller on its usual providers", async () => {
        await aiService.askAI("Write an email", TEAM, { complexity: TaskComplexity.ROUTINE, disableGuardrails: true });
        expect(ctor.openai[0]).toMatchObject({ apiKey: "team-openai" });
        expect(ctor.openai[0].baseURL).toBeUndefined();
    });
});
