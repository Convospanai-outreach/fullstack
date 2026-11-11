import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearchPlaybook, mockSearchGold } = vi.hoisted(() => ({ mockSearchPlaybook: vi.fn(), mockSearchGold: vi.fn() }));

vi.mock("@/modules/playbook/playbookStore", () => ({ searchPlaybook: mockSearchPlaybook }));
vi.mock("@/modules/gold/goldSet", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/modules/gold/goldSet")>()),
    searchGold: mockSearchGold,
}));

import { loadCopyContext, renderCopyContext, retrievalEnabled } from "../copyContext";

const input = { prospect_title: "title-x", pain_context: "pain-x", hypothesis: "hyp-x", extracted_signal: "signal-x" };
const playbookHit = (text: string) => ({ id: "p", content: text, heading: "h", file: "f", similarity: 0.8 });
const goldHit = (subject: string, similarity: number) => ({ exampleId: "e", node: "A", situation: "s", subject, body: `body ${subject}`, notes: null, similarity });

const saved = { ...process.env };
beforeEach(() => {
    vi.clearAllMocks();
    process.env["COPY_RETRIEVAL"] = "on";
    process.env["PLAYBOOK_TEAM_ID"] = "pb-team";
    process.env["GOLD_TEAM_ID"] = "gold-team";
    mockSearchPlaybook.mockResolvedValue([]);
    mockSearchGold.mockResolvedValue([]);
});
afterEach(() => {
    process.env = { ...saved };
});

describe("loadCopyContext", () => {
    it("is off by default and searches nothing", async () => {
        delete process.env["COPY_RETRIEVAL"];
        expect(retrievalEnabled()).toBe(false);
        expect(await loadCopyContext("A", input)).toBeNull();
        expect(mockSearchPlaybook).not.toHaveBeenCalled();
        expect(mockSearchGold).not.toHaveBeenCalled();
    });

    it("searches the platform teams named by the sync scripts' env variables", async () => {
        mockSearchPlaybook.mockResolvedValue([playbookHit("pb-1")]);
        await loadCopyContext("B", input);
        expect(mockSearchPlaybook).toHaveBeenCalledWith(expect.stringContaining("pain_context: pain-x"), "pb-team", { limit: 3 });
        expect(mockSearchGold).toHaveBeenCalledWith(input, "B", "gold-team", { limit: 3 });
    });

    it("returns nothing when neither search finds anything", async () => {
        expect(await loadCopyContext("A", input)).toBeNull();
    });

    it("drops a gold hit that is almost identical to the situation, and keeps at most two examples", async () => {
        mockSearchGold.mockResolvedValue([goldHit("same", 0.99), goldHit("one", 0.8), goldHit("two", 0.7), goldHit("three", 0.6)]);
        const context = await loadCopyContext("A", input);
        expect(context?.examples.map((e) => e.subject)).toEqual(["one", "two"]);
    });

    it("truncates long passages", async () => {
        mockSearchPlaybook.mockResolvedValue([playbookHit("x".repeat(5000))]);
        const context = await loadCopyContext("A", input);
        expect(context!.playbook[0].length).toBeLessThan(1300);
    });
});

describe("renderCopyContext", () => {
    it("adds nothing without context, so the prompt is unchanged", () => {
        expect(renderCopyContext(null)).toBe("");
        expect(renderCopyContext(undefined)).toBe("");
        expect(renderCopyContext({ playbook: [], examples: [] })).toBe("");
    });

    it("tells the model to take structure and tone, never facts, from the examples", () => {
        const text = renderCopyContext({ playbook: ["pb-1"], examples: [{ subject: "sub-1", body: "body-1" }] });
        expect(text).toContain("## PLAYBOOK GUIDANCE");
        expect(text).toContain("- pb-1");
        expect(text).toContain("Subject: sub-1");
        expect(text).toMatch(/Never reuse their names, companies, numbers or claims/);
    });
});
