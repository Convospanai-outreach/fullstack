import { describe, expect, it } from "vitest";
import { enforceAgentOutputGuardrails, enforceMultilineGuardrails } from "./agentOutputGuardrails";

describe("enforceMultilineGuardrails", () => {
    it("keeps line breaks and blank lines between paragraphs", () => {
        const out = enforceMultilineGuardrails("First paragraph.\n\nSecond paragraph.");
        expect(out.text).toBe("First paragraph.\n\nSecond paragraph.");
        expect(out.issues).toEqual([]);
    });

    it("drops a line that is removed entirely instead of substituting the no-evidence sentence", () => {
        const out = enforceMultilineGuardrails("Keep this.\n\nResearch confirms it works.\n\nKeep that.");
        expect(out.text).toBe("Keep this.\n\nKeep that.");
        expect(out.issues.map((issue) => issue.code)).toContain("UNGROUNDED_REFERENCE");
    });

    it("returns empty text, not a substitute sentence, when nothing survives", () => {
        expect(enforceMultilineGuardrails("Research confirms it works.").text).toBe("");
    });

    it("flags a number that is not in the source context and allows one that is", () => {
        const options = { sourceContext: "Raised $20M", strictGrounding: true };
        expect(enforceMultilineGuardrails("Saw the $20M round.", options).text).toBe("Saw the $20M round.");
        expect(enforceMultilineGuardrails("Saw the $30M round.", options).text).toBe("");
    });

    it("leaves enforceAgentOutputGuardrails behavior unchanged (one line, substitute sentence when empty)", () => {
        expect(enforceAgentOutputGuardrails("One.\n\nTwo.").text).toBe("One. Two.");
        expect(enforceAgentOutputGuardrails("Research confirms it works.").text).toContain("do not have enough grounded evidence");
    });
});
