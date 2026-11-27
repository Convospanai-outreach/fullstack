import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aiService", () => ({ aiService: {} }));
vi.mock("@/modules/learning/learningService", () => ({ LearningService: { getMemories: vi.fn() } }));

import { buildCritiquePrompt } from "../../service/emailComposer";
import { ANGLE_MARKER } from "../researchMatch";

const nodeA = {
    prospect_name: "P", prospect_title: "T", prospect_company: "C", pain_context: "pain", outreach_timing: "t",
    avoid_topics: [], hypothesis: "h", signal_type: "s", extracted_signal: "sig", sender_name: "S", sender_email: "s@x.com",
};
const draft = { subject: "s", body: "b" };

describe("critic research criterion", () => {
    it("is added only when the input carries a researched angle", () => {
        expect(buildCritiquePrompt({ ...nodeA, campaign_brief: `## ${ANGLE_MARKER}\nx` }, draft)).toContain("9. RESEARCH:");
        expect(buildCritiquePrompt({ ...nodeA, campaign_brief: "Problem: x" }, draft)).not.toContain("RESEARCH:");
        expect(buildCritiquePrompt(nodeA, draft)).not.toContain("RESEARCH:");
    });
});
