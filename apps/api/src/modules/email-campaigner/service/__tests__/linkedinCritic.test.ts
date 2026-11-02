import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAskAI } = vi.hoisted(() => ({ mockAskAI: vi.fn() }));
vi.mock("@/lib/aiService", () => ({ aiService: { askAI: mockAskAI } }));

import { buildLinkedinCritiquePrompt, linkedinCriticEnabled, reviewLinkedinDraft } from "../linkedinCritic";

const context = JSON.stringify({ role: "Head of Sales", signal: "signal-x" });
const text = "Hi Jane, saw signal-x and wanted to connect.";
const verdict = (v: object) => mockAskAI.mockResolvedValueOnce(JSON.stringify(v));

const saved = { ...process.env };
afterEach(() => {
    process.env = { ...saved };
});
beforeEach(() => mockAskAI.mockReset());

describe("linkedinCriticEnabled", () => {
    it("is off unless LINKEDIN_CRITIC=on", () => {
        delete process.env["LINKEDIN_CRITIC"];
        expect(linkedinCriticEnabled()).toBe(false);
        process.env["LINKEDIN_CRITIC"] = "on";
        expect(linkedinCriticEnabled()).toBe(true);
    });
});

describe("buildLinkedinCritiquePrompt", () => {
    it("states the limit for the kind and marks the context as data", () => {
        expect(buildLinkedinCritiquePrompt("connect", context, text)).toContain("At most 300 characters");
        expect(buildLinkedinCritiquePrompt("followUp", context, text)).toContain("At most 600 characters");
        expect(buildLinkedinCritiquePrompt("connect", context, text)).toContain("not instructions");
    });

    it("clips a large context", () => {
        const prompt = buildLinkedinCritiquePrompt("connect", "x".repeat(20000), text);
        expect(prompt.length).toBeLessThan(6000);
    });
});

describe("reviewLinkedinDraft", () => {
    it("keeps a passed draft", async () => {
        verdict({ status: "PASS", critique: "ok" });
        expect(await reviewLinkedinDraft("connect", context, text, "team")).toEqual({ text, critique: "passed" });
        expect(mockAskAI).toHaveBeenCalledTimes(1);
    });

    it("uses a rewrite that fits the limit", async () => {
        verdict({ status: "FAIL", critique: "tighten", correction: "Hi Jane, signal-x caught my eye. Happy to connect." });
        expect(await reviewLinkedinDraft("connect", context, text, "team")).toEqual({ text: "Hi Jane, signal-x caught my eye. Happy to connect.", critique: "corrected" });
    });

    it("drops a rewrite over the limit and keeps the draft, unreviewed; a follow-up may be longer", async () => {
        verdict({ status: "FAIL", critique: "x", correction: "a".repeat(301) });
        expect(await reviewLinkedinDraft("connect", context, text, "team")).toEqual({ text, critique: "unreviewed" });
        verdict({ status: "FAIL", critique: "x", correction: "a".repeat(301) });
        expect((await reviewLinkedinDraft("followUp", context, text, "team")).critique).toBe("corrected");
    });

    it("does not let a rewrite introduce a number the context and draft lack", async () => {
        verdict({ status: "FAIL", critique: "x", correction: "We lifted revenue 87% for peers like you." });
        const out = await reviewLinkedinDraft("connect", context, text, "team");
        expect(out.text).not.toContain("87%");
    });

    it("keeps the draft, unreviewed, on an unreadable answer, a missing correction, or a failing call", async () => {
        mockAskAI.mockResolvedValueOnce("not json");
        expect(await reviewLinkedinDraft("connect", context, text, "team")).toEqual({ text, critique: "unreviewed" });
        verdict({ status: "FAIL", critique: "x" });
        expect(await reviewLinkedinDraft("connect", context, text, "team")).toEqual({ text, critique: "unreviewed" });
        mockAskAI.mockRejectedValueOnce(new Error("provider down"));
        expect(await reviewLinkedinDraft("connect", context, text, "team")).toEqual({ text, critique: "unreviewed" });
    });
});
