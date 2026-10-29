import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAskAI, mockGetMemories } = vi.hoisted(() => ({
    mockAskAI: vi.fn(),
    mockGetMemories: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/aiService", () => ({
    aiService: { askAI: mockAskAI },
}));
vi.mock("@/modules/learning/learningService", () => ({
    LearningService: { getMemories: mockGetMemories },
}));

import { composeNodeA, composeNodeB, type NodeAInput, type NodeBInput } from "../emailComposer";

const inputA: NodeAInput = {
    prospect_name: "Jane Doe",
    prospect_title: "VP Sales",
    prospect_company: "Acme Corp",
    pain_context: "Scaling outbound without headcount",
    outreach_timing: "Just raised Series B",
    avoid_topics: [],
    hypothesis: "They need better lead qualification",
    signal_type: "funding",
    extracted_signal: "Announced $20M Series B",
    sender_name: "Alex",
    sender_email: "alex@example.com",
};

const inputB: NodeBInput = {
    prospect_name: "Jane Doe",
    prospect_title: "VP Sales",
    prospect_company: "Acme Corp",
    original_subject: "Hi",
    original_body: "Hello",
    hypothesis: "They need better lead qualification",
    pain_context: "Scaling outbound without headcount",
    days_since_send: 3,
};

const draftA = JSON.stringify({ subject: "Draft subject", body: "Draft body", internal_notes: "notes" });
const draftB = JSON.stringify({ subject: "Draft subject", body: "Draft body", reasoning: "why" });

// First askAI call writes the draft, the second is the critic.
function critic(answer: string, draft: string) {
    mockAskAI.mockResolvedValueOnce(draft).mockResolvedValueOnce(answer);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAskAI.mockReset();
    mockGetMemories.mockResolvedValue([]);
});

describe("composeNodeA critique", () => {
    it("returns the draft unflagged when the critic passes it", async () => {
        critic(JSON.stringify({ status: "PASS" }), draftA);
        const out = await composeNodeA(inputA, "team-1");
        expect(out.unreviewed).toBeUndefined();
        expect(out.subject).toBe("Draft subject");
    });

    it("applies the critic's correction and does not flag it", async () => {
        critic(JSON.stringify({ status: "FAIL", critique: "too generic", correction: { subject: "Better subject", body: "Better body" } }), draftA);
        const out = await composeNodeA(inputA, "team-1");
        expect(out).toMatchObject({ subject: "Better subject", body: "Better body" });
        expect(out.unreviewed).toBeUndefined();
        expect(out.internal_notes).toContain("[SELF-CORRECTION]");
    });

    it("flags the draft unreviewed and logs when the critic's answer is not valid JSON, without logging the draft", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        critic("Sure! Here is my review: looks fine.", draftA);

        const out = await composeNodeA(inputA, "team-1");

        expect(out).toMatchObject({ subject: "Draft subject", body: "Draft body", unreviewed: true });
        expect(out.internal_notes).toContain("[UNREVIEWED]");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Critique] Node A"), expect.anything());
        expect(JSON.stringify(warn.mock.calls)).not.toContain("Draft body");
        warn.mockRestore();
    });

    it("flags the draft unreviewed when the critic fails it but gives no correction", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        critic(JSON.stringify({ status: "FAIL", critique: "weak opener" }), draftA);

        const out = await composeNodeA(inputA, "team-1");

        expect(out.unreviewed).toBe(true);
        expect(out.subject).toBe("Draft subject");
        warn.mockRestore();
    });
});

describe("composeNodeB critique", () => {
    it("flags the draft unreviewed and logs when the critic's answer is not valid JSON", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        critic("not json", draftB);

        const out = await composeNodeB(inputB, "team-1");

        expect(out).toMatchObject({ subject: "Draft subject", unreviewed: true });
        expect(out.reasoning).toContain("[UNREVIEWED]");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Critique] Node B"), expect.anything());
        warn.mockRestore();
    });

    it("returns the draft unflagged when the critic passes it", async () => {
        critic(JSON.stringify({ status: "PASS" }), draftB);
        const out = await composeNodeB(inputB, "team-1");
        expect(out.unreviewed).toBeUndefined();
    });
});

describe("critique rewrite guardrails", () => {
    it("drops an invented statistic from the rewrite but keeps the rest and the paragraph breaks", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        critic(JSON.stringify({
            status: "FAIL",
            critique: "generic",
            correction: {
                subject: "Quick idea",
                body: "Congrats on the Series B.\n\nTeams like yours cut qualification time by 63% in a month.\n\nWorth a short call?",
            },
        }), draftA);

        const out = await composeNodeA(inputA, "team-1");

        expect(out.body).toBe("Congrats on the Series B.\n\nWorth a short call?");
        expect(out.body).not.toContain("63%");
        expect(out.unreviewed).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Guardrails] Node A"), { issues: ["UNGROUNDED_NUMERIC"] });
        warn.mockRestore();
    });

    it("keeps a number that is already in the input", async () => {
        critic(JSON.stringify({
            status: "FAIL",
            critique: "generic",
            correction: { subject: "Your $20M round", body: "Saw the $20M Series B announcement.\n\nWorth a short call?" },
        }), draftA);

        const out = await composeNodeA(inputA, "team-1");

        expect(out.body).toContain("$20M");
    });

    it("softens a guarantee in the rewrite", async () => {
        critic(JSON.stringify({
            status: "FAIL",
            critique: "weak",
            correction: { subject: "Idea", body: "We guarantee more meetings.\n\nWorth a short call?" },
        }), draftB);

        const out = await composeNodeB(inputB, "team-1");

        expect(out.body).not.toContain("guarantee");
        expect(out.body).toContain("likely");
    });

    it("keeps the original draft, marked unreviewed, when the whole rewrite is ungrounded", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        critic(JSON.stringify({
            status: "FAIL",
            critique: "weak",
            correction: { subject: "Idea", body: "Research confirms 80% of teams switch." },
        }), draftA);

        const out = await composeNodeA(inputA, "team-1");

        expect(out).toMatchObject({ subject: "Draft subject", body: "Draft body", unreviewed: true });
        warn.mockRestore();
    });
});
