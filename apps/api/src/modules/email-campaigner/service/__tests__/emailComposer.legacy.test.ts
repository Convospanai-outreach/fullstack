import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAskAI } = vi.hoisted(() => ({ mockAskAI: vi.fn() }));

vi.mock("@/lib/aiService", () => ({ aiService: { askAI: mockAskAI } }));
vi.mock("@/modules/learning/learningService", () => ({ LearningService: { getMemories: vi.fn().mockResolvedValue([]) } }));
vi.mock("../rubricCritic", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../rubricCritic")>()),
    loadCriticRubric: () => null,
}));

import { legacyCriticEnabled, reviewLegacyDraft } from "../emailComposer";

const lead = { id: "lead-1", fullName: "Jane Doe", jobTitle: "VP Sales", company: "Acme Corp", email: "jane@example.com", enrichedData: { signal: "signal-x" } };
const draft = { subject: "Draft subject", body: "Draft body" };

const saved = { ...process.env };
afterEach(() => {
    process.env = { ...saved };
});
beforeEach(() => mockAskAI.mockReset());

describe("legacyCriticEnabled", () => {
    it("is off unless LEGACY_CRITIC=on", () => {
        delete process.env["LEGACY_CRITIC"];
        expect(legacyCriticEnabled()).toBe(false);
        process.env["LEGACY_CRITIC"] = "on";
        expect(legacyCriticEnabled()).toBe(true);
    });
});

describe("reviewLegacyDraft", () => {
    it("keeps a passed draft", async () => {
        mockAskAI.mockResolvedValue(JSON.stringify({ status: "PASS", critique: "ok" }));
        expect(await reviewLegacyDraft(lead, null, draft, "team")).toEqual({ draft, critique: "passed", rubricCritic: false });
        expect(mockAskAI).toHaveBeenCalledTimes(1);
    });

    it("uses the critic's rewrite, and marks it corrected", async () => {
        mockAskAI.mockResolvedValue(JSON.stringify({ status: "FAIL", critique: "tighten", correction: { subject: "New subject", body: "New body" } }));
        const out = await reviewLegacyDraft(lead, null, draft, "team");
        expect(out).toMatchObject({ draft: { subject: "New subject", body: "New body" }, critique: "corrected" });
    });

    it("keeps the draft and marks it unreviewed when the critic's answer is unusable", async () => {
        mockAskAI.mockResolvedValue("not json");
        expect(await reviewLegacyDraft(lead, null, draft, "team")).toMatchObject({ draft, critique: "unreviewed" });
    });

    it("keeps the draft and marks it unreviewed when the critic call fails", async () => {
        mockAskAI.mockRejectedValueOnce(new Error("provider down"));
        expect(await reviewLegacyDraft(lead, null, draft, "team")).toMatchObject({ draft, critique: "unreviewed" });
    });

    it("does not let a rewrite introduce a number the draft and the lead facts lack", async () => {
        mockAskAI.mockResolvedValue(JSON.stringify({ status: "FAIL", critique: "x", correction: { subject: "S", body: "We lifted revenue 87% for peers." } }));
        const out = await reviewLegacyDraft(lead, null, draft, "team");
        expect(out.draft.body).not.toContain("87%");
    });
});
