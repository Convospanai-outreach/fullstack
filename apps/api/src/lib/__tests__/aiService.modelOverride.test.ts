import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockOpenAICreate, ctor } = vi.hoisted(() => ({
    ctor: { openai: [] as any[] },
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
        constructor(options: any) { ctor.openai.push(options); }
    }
}));

import { aiService, withModelOverride } from "../aiService";

const TEAM = "3f1c2a4e-8b7d-4c1a-9e2f-1a2b3c4d5e6f";
const ask = () => aiService.askAI("Write a short note", TEAM, { disableGuardrails: true });

// OpenAI and DeepSeek share the OpenAI client, so the client options and the model name show which
// provider a call really used. Without an override OpenAI is tried before DeepSeek.
describe("withModelOverride", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ctor.openai = [];
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: { providers: { openai: { apiKey: "team-openai", model: "gpt-default" }, deepseek: { apiKey: "team-deepseek" } } }
        });
        mockOpenAICreate.mockResolvedValue({ choices: [{ message: { content: "A plain note." } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    });

    it("leaves calls outside it on the usual provider", async () => {
        await ask();
        expect(ctor.openai[0]).toMatchObject({ apiKey: "team-openai" });
        expect(mockOpenAICreate.mock.calls[0]![0].model).toBe("gpt-default");
    });

    it("sends calls inside it to the named provider and model", async () => {
        await withModelOverride({ provider: "deepseek", model: "deepseek-pinned" }, ask);
        expect(ctor.openai[0]).toMatchObject({ apiKey: "team-deepseek", baseURL: "https://api.deepseek.com" });
        expect(mockOpenAICreate.mock.calls[0]![0].model).toBe("deepseek-pinned");
    });

    it("never falls back to another provider when the pinned one fails", async () => {
        mockOpenAICreate.mockRejectedValue(new Error("boom"));
        await expect(withModelOverride({ provider: "deepseek", model: "deepseek-pinned" }, ask)).rejects.toThrow("boom");
        expect(ctor.openai.every((o) => o.apiKey === "team-deepseek")).toBe(true);
    });

    it("fails before any call when the team has no key for the pinned provider", async () => {
        await expect(withModelOverride({ provider: "gemini", model: "gemini-x" }, ask)).rejects.toThrow(/no gemini key/i);
        expect(mockOpenAICreate).not.toHaveBeenCalled();
    });

    describe("open (any OpenAI-compatible host)", () => {
        const ENV = { OPEN_MODEL_API_KEY: "open-key", OPEN_MODEL_BASE_URL: "https://open.example/v1", OPEN_MODEL_SMALL: "small-m", OPEN_MODEL_LARGE: "large-m" };
        afterEach(() => { for (const k of Object.keys(ENV)) delete process.env[k]; });

        it("sends calls to the open host with the model named in the override", async () => {
            Object.assign(process.env, ENV);
            await withModelOverride({ provider: "open", model: "llama-3-70b" }, ask);
            expect(ctor.openai[0]).toMatchObject({ apiKey: "open-key", baseURL: "https://open.example/v1" });
            expect(mockOpenAICreate.mock.calls[0]![0].model).toBe("llama-3-70b");
        });

        it("fails before any call when the open host is not configured", async () => {
            await expect(withModelOverride({ provider: "open", model: "llama-3-70b" }, ask)).rejects.toThrow(/no open key/i);
            expect(mockOpenAICreate).not.toHaveBeenCalled();
        });
    });

    it("keeps concurrent overrides apart", async () => {
        await Promise.all([
            withModelOverride({ provider: "deepseek", model: "model-one" }, ask),
            withModelOverride({ provider: "openai", model: "model-two" }, ask),
        ]);
        const models = mockOpenAICreate.mock.calls.map((c) => c[0].model).sort();
        expect(models).toEqual(["model-one", "model-two"]);
    });
});
