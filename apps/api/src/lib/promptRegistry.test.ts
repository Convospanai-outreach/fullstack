import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aiService", () => ({ aiService: { askAI: vi.fn() } }));
vi.mock("@/modules/learning/learningService", () => ({ LearningService: { getMemories: vi.fn() } }));

import {
    buildCritiquePrompt,
    buildNodeAPrompt,
    buildNodeASystemPrompt,
    buildNodeBPrompt,
    buildNodeCPrompt,
} from "@/modules/email-campaigner/service/emailComposer";
import { buildRubricCritiquePrompt } from "@/modules/email-campaigner/service/rubricCritic";
import { allPromptRefs, fingerprintPrompt, PROMPT_REGISTRY, promptRef, type PromptId } from "./promptRegistry";

// Placeholder input: the fingerprint depends on the prompt text, not on any real data.
const style = { tone: "tone-x", voice: "voice-x", formulation: "form-x", greeting_style: "greet-x", sign_off: "sign-x", cta_style: "cta-x", constraints: "con-x" };
const nodeA = {
    prospect_name: "P", prospect_title: "T", prospect_company: "C", pain_context: "pain", outreach_timing: "timing",
    avoid_topics: ["avoid"], hypothesis: "hyp", signal_type: "sig", extracted_signal: "signal", sender_name: "S", sender_email: "s@example.com",
    knowledge_context: "kb", memories: ["memory"], ...style,
};
const followUp = {
    prospect_name: "P", prospect_title: "T", prospect_company: "C", original_subject: "os", original_body: "ob",
    hypothesis: "hyp", pain_context: "pain", days_since_send: 3, signal_type: "sig", memories: ["memory"], ...style,
};
const draft = { subject: "s", body: "b" };
// The retrieval sections are part of the draft prompts, so they are rendered here with placeholders.
const context = { playbook: ["playbook-x"], examples: [{ subject: "subject-x", body: "body-x" }] };

const RENDERED: Record<PromptId, string> = {
    "email.nodeA.system": buildNodeASystemPrompt(nodeA),
    "email.nodeA": buildNodeAPrompt(nodeA, context),
    "email.nodeB": buildNodeBPrompt(followUp, context),
    "email.nodeC": buildNodeCPrompt(followUp, context),
    "email.critique": buildCritiquePrompt(nodeA, draft),
    "email.critique.rubric": buildRubricCritiquePrompt(nodeA, draft, { criteria: [{ id: "crit-x", description: "desc-x", weight: 1 }], passScore: 4 }, "style-x"),
};

describe("prompt registry", () => {
    it.each(Object.keys(PROMPT_REGISTRY) as PromptId[])(
        "%s still renders the prompt that its registered version describes",
        (id) => {
            // Failing here means the prompt text changed: bump `version` and update `fingerprint`.
            expect(fingerprintPrompt(RENDERED[id])).toBe(PROMPT_REGISTRY[id].fingerprint);
        },
    );

    it("gives every registered prompt a positive integer version", () => {
        for (const entry of Object.values(PROMPT_REGISTRY)) {
            expect(Number.isInteger(entry.version) && entry.version >= 1).toBe(true);
        }
    });

    it("names a prompt id@vN", () => {
        expect(promptRef("email.nodeA")).toBe("email.nodeA@v2");
        expect(allPromptRefs()["email.critique"]).toBe("email.critique@v1");
        expect(Object.keys(allPromptRefs())).toEqual(Object.keys(PROMPT_REGISTRY));
    });

    it("fingerprints differ when the text differs", () => {
        expect(fingerprintPrompt("a")).not.toBe(fingerprintPrompt("b"));
        expect(fingerprintPrompt("a")).toHaveLength(12);
    });
});
