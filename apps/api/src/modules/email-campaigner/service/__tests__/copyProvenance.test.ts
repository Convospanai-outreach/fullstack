import { describe, expect, it } from "vitest";
import { buildProvenance, readProvenance } from "../copyProvenance";

const base = { retrievalOn: true, briefOn: false, rubricCritic: false, playbook: 2, examples: 1, briefUsed: false, critique: "passed" as const };

describe("buildProvenance", () => {
    it("records prompt refs, switches, context counts and the critique outcome, and nothing else", () => {
        expect(buildProvenance(base)).toEqual({
            v: 1,
            node: "A",
            prompts: { draft: "email.nodeA@v3", system: "email.nodeA.system@v1", critique: "email.critique@v1" },
            flags: { retrieval: true, brief: false, rubricCritic: false },
            context: { playbook: 2, examples: 1, brief: false },
            critique: "passed",
        });
    });

    it("names the rubric critique prompt when the rubric critic ran", () => {
        expect(buildProvenance({ ...base, rubricCritic: true }).prompts.critique).toBe("email.critique.rubric@v1");
    });
});

describe("readProvenance", () => {
    it("round-trips what was built", () => {
        const built = buildProvenance(base);
        expect(readProvenance(JSON.parse(JSON.stringify(built)))).toEqual(built);
    });

    it("ignores anything that is not provenance", () => {
        for (const value of [null, undefined, "x", 3, {}, { v: 2, node: "A" }, { v: 1, node: "B" }]) expect(readProvenance(value)).toBeNull();
    });
});
