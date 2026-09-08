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

import { composeNodeA, type NodeAInput } from "../emailComposer";

const baseInput: NodeAInput = {
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

describe("composeNodeA - provider-native prompt caching (system/user prompt split)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetMemories.mockResolvedValue([]);
        mockAskAI.mockResolvedValue(
            JSON.stringify({ subject: "Hi", body: "Hello there", internal_notes: "" })
        );
    });

    it("sends the static rules/style block as systemPrompt, not baked into the per-lead prompt", async () => {
        await composeNodeA(baseInput, "team-1");

        const [prompt, , taskContext] = mockAskAI.mock.calls[0];

        // Static, team-stable instructions belong in systemPrompt so
        // Anthropic/OpenAI can cache them across every lead in a campaign
        // instead of rebilling the same ~20 lines as fresh input tokens.
        expect(taskContext.systemPrompt).toContain("You write B2B cold emails");
        expect(taskContext.systemPrompt).toContain("## STYLE SETTINGS");
        expect(prompt).not.toContain("You write B2B cold emails");

        // Per-lead dynamic content stays in the user prompt.
        expect(prompt).toContain("## INPUT");
    });
});
