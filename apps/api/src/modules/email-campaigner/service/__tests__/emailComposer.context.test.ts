import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAskAI, mockLoadContext, mockLoadBrief } = vi.hoisted(() => ({ mockAskAI: vi.fn(), mockLoadContext: vi.fn(), mockLoadBrief: vi.fn().mockResolvedValue("") }));

vi.mock("../copyBrief", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../copyBrief")>()),
    loadCampaignBrief: mockLoadBrief,
}));

vi.mock("@/lib/aiService", () => ({ aiService: { askAI: mockAskAI } }));
vi.mock("@/modules/learning/learningService", () => ({ LearningService: { getMemories: vi.fn().mockResolvedValue([]) } }));
vi.mock("../rubricCritic", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../rubricCritic")>()),
    loadCriticRubric: () => null,
}));
vi.mock("../copyContext", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../copyContext")>()),
    loadCopyContext: mockLoadContext,
}));

import { composeNodeA, composeNodeB, composeNodeC, type NodeAInput, type NodeBInput, type NodeCInput } from "../emailComposer";

const inputA: NodeAInput = {
    prospect_name: "Jane Doe", prospect_title: "VP Sales", prospect_company: "Acme Corp", pain_context: "pain-x", outreach_timing: "timing-x",
    avoid_topics: [], hypothesis: "hyp-x", signal_type: "funding", extracted_signal: "signal-x", sender_name: "Alex", sender_email: "alex@example.com",
};
const inputB: NodeBInput = { prospect_name: "Jane Doe", prospect_title: "VP Sales", prospect_company: "Acme Corp", original_subject: "Hi", original_body: "Hello", hypothesis: "hyp-x", pain_context: "pain-x", days_since_send: 3 };
const inputC: NodeCInput = { prospect_name: "Jane Doe", prospect_title: "VP Sales", prospect_company: "Acme Corp", original_subject: "Hi", original_body: "Hello", hypothesis: "hyp-x", signal_type: "funding" };

const draft = JSON.stringify({ subject: "Draft subject", body: "Draft body", internal_notes: "n", reasoning: "r" });
const context = { playbook: ["playbook-marker"], examples: [{ subject: "example-subject-marker", body: "example-body-marker" }] };

beforeEach(() => {
    vi.clearAllMocks();
    mockAskAI.mockReset();
    mockAskAI.mockResolvedValueOnce(draft).mockResolvedValueOnce(JSON.stringify({ status: "PASS", critique: "ok" }));
});

const cases = [
    ["A", () => composeNodeA({ ...inputA }, "team")],
    ["B", () => composeNodeB({ ...inputB }, "team")],
    ["C", () => composeNodeC({ ...inputC }, "team")],
] as const;

describe.each(cases)("Node %s retrieval context", (node, run) => {
    it("shows the context to the draft prompt only, never to the critique", async () => {
        mockLoadContext.mockResolvedValue(context);
        await run();
        expect(mockLoadContext).toHaveBeenCalledWith(node, expect.any(Object));
        const [draftPrompt, critiquePrompt] = mockAskAI.mock.calls.map((c) => c[0] as string);
        expect(draftPrompt).toContain("playbook-marker");
        expect(draftPrompt).toContain("example-subject-marker");
        expect(critiquePrompt).not.toContain("playbook-marker");
        expect(critiquePrompt).not.toContain("example-subject-marker");
        expect(critiquePrompt).not.toContain("example-body-marker");
    });

    it("leaves the draft prompt without those sections when there is no context", async () => {
        mockLoadContext.mockResolvedValue(null);
        await run();
        const draftPrompt = mockAskAI.mock.calls[0][0] as string;
        expect(draftPrompt).not.toContain("PLAYBOOK GUIDANCE");
        expect(draftPrompt).not.toContain("EXAMPLES OF GOOD COPY");
    });
});

describe("Node A campaign brief", () => {
    it("is shown to the draft prompt, and absent when there is none", async () => {
        mockLoadContext.mockResolvedValue(null);
        mockLoadBrief.mockResolvedValue("Problem: brief-marker");
        await composeNodeA({ ...inputA }, "team", "camp-1", undefined);
        expect(mockLoadBrief).toHaveBeenCalledWith("camp-1", "team");
        const [draftPrompt] = mockAskAI.mock.calls.map((c) => c[0] as string);
        expect(draftPrompt).toContain("## CAMPAIGN BRIEF");
        expect(draftPrompt).toContain("brief-marker");

        mockAskAI.mockReset();
        mockAskAI.mockResolvedValueOnce(draft).mockResolvedValueOnce(JSON.stringify({ status: "PASS", critique: "ok" }));
        mockLoadBrief.mockResolvedValue("");
        await composeNodeA({ ...inputA }, "team", "camp-1", undefined);
        expect(mockAskAI.mock.calls[0][0]).not.toContain("CAMPAIGN BRIEF");
    });
});

describe("Node A provenance", () => {
    const run = async (critique: object | string) => {
        mockAskAI.mockReset();
        mockAskAI.mockResolvedValueOnce(draft).mockResolvedValueOnce(typeof critique === "string" ? critique : JSON.stringify(critique));
        return composeNodeA({ ...inputA }, "team", "camp-1");
    };

    it("records the context the draft received and that the critic passed it", async () => {
        mockLoadContext.mockResolvedValue({ playbook: ["a", "b"], examples: [{ subject: "s", body: "b" }] });
        mockLoadBrief.mockResolvedValue("Problem: x");
        const out = await run({ status: "PASS", critique: "ok" });
        expect(out.provenance).toMatchObject({ v: 1, node: "A", context: { playbook: 2, examples: 1, brief: true }, critique: "passed", flags: { rubricCritic: false } });
        expect(out.provenance?.prompts.draft).toBe("email.nodeA@v3");
    });

    it("records a corrected draft and an unreviewed one", async () => {
        mockLoadContext.mockResolvedValue(null);
        mockLoadBrief.mockResolvedValue("");
        const corrected = await run({ status: "FAIL", critique: "tighten", correction: { subject: "New subject", body: "New body" } });
        expect(corrected.provenance).toMatchObject({ critique: "corrected", context: { playbook: 0, examples: 0, brief: false } });
        const unreviewed = await run("not json");
        expect(unreviewed.unreviewed).toBe(true);
        expect(unreviewed.provenance?.critique).toBe("unreviewed");
    });
});
