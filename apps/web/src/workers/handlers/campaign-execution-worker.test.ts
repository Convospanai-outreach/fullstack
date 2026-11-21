import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logCriticalAlert: vi.fn() }));
vi.mock("@google/generative-ai", () => ({
    GoogleGenerativeAI: class {
        getGenerativeModel() { return { generateContent }; }
    },
}));

import { generateEmailDraftWithAI } from "./campaign-execution-worker";
import { PiiMaskingError } from "@/lib/ai/piiMask";

const LEAD = { id: "l1", fullName: "Asha Rao", company: "Acme Logistics", email: "asha.rao@acme.example" };

describe("generateEmailDraftWithAI - personal data and the cloud model (DPDP)", () => {
    const saved = { masking: process.env["LLM_PII_MASKING"], key: process.env["GEMINI_API_KEY"], provider: process.env["AI_PROVIDER"] };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["GEMINI_API_KEY"] = "test-key";
        delete process.env["AI_PROVIDER"];
        process.env["LLM_PII_MASKING"] = "on";
        // The "model" greets whatever name it was shown, so a masked prompt yields a placeholder in the draft.
        generateContent.mockImplementation(async (prompt: string) => {
            const who = prompt.match(/Recipient Name: (\S+)/)?.[1] ?? "?";
            return { response: { text: () => JSON.stringify({ subject: `Hello ${who}`, body: `Hi ${who}, a note about ${prompt.match(/Recipient Company: ([^\n]+)/)?.[1]}` }) } };
        });
    });

    afterEach(() => {
        for (const [k, v] of [["LLM_PII_MASKING", saved.masking], ["GEMINI_API_KEY", saved.key], ["AI_PROVIDER", saved.provider]] as const) {
            if (v === undefined) delete process.env[k]; else process.env[k] = v;
        }
    });

    it("sends the model a placeholder instead of the lead's name, and the draft comes back with the real name", async () => {
        const draft = await generateEmailDraftWithAI("Spring push", "Offer a free audit. Call +91 98765 43210 or asha.rao@acme.example", LEAD);

        const sent = String(generateContent.mock.calls[0][0]);
        expect(sent).not.toMatch(/Asha|Rao/);
        expect(sent).not.toContain("98765");
        expect(sent).not.toContain("asha.rao@acme.example");
        expect(draft.providerUsed).toBe("gemini-2.0-flash");
        expect(draft.subject).toContain("Asha");
        expect(draft.body).toContain("Asha");
    });

    it("fails closed: when masking throws, the model is not called and the error is raised, not hidden behind a template", async () => {
        const piiMask = await import("@/lib/ai/piiMask");
        const spy = vi.spyOn(piiMask, "maskForLLM").mockImplementationOnce(() => { throw new PiiMaskingError(); });

        await expect(generateEmailDraftWithAI("Spring push", "x", LEAD)).rejects.toThrow(PiiMaskingError);

        expect(generateContent).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("sends the prompt as it always did when masking is not switched on", async () => {
        delete process.env["LLM_PII_MASKING"];

        await generateEmailDraftWithAI("Spring push", "x", LEAD);

        expect(String(generateContent.mock.calls[0][0])).toContain("Asha");
    });
});
