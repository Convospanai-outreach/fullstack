import { describe, expect, it } from "vitest";
import { buildProvenance, JEV_SCREEN_REF, legacyProvenance, linkedinProvenance, readProvenance } from "../copyProvenance";

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

describe("legacyProvenance", () => {
    it("records the older draft prompt with no critic, context or switches", () => {
        expect(legacyProvenance(false)).toEqual({
            v: 1,
            node: "legacy",
            prompts: { draft: "email.legacyDraft@v1", system: "none", critique: "none" },
            flags: { retrieval: false, brief: false, rubricCritic: false },
            context: { playbook: 0, examples: 0, brief: false },
            critique: "unreviewed",
        });
        expect(legacyProvenance(true).prompts.draft).toBe("email.legacyBatch@v1");
    });

    it("reads back like any other provenance", () => {
        expect(readProvenance(JSON.parse(JSON.stringify(legacyProvenance(false))))).toEqual(legacyProvenance(false));
    });
});

describe("legacyProvenance with a critic", () => {
    it("names the critic prompt and the outcome", () => {
        const p = legacyProvenance(false, { critique: "passed", rubricCritic: true });
        expect(p).toMatchObject({ critique: "passed", prompts: { draft: "email.legacyDraft@v1", critique: "email.critique.rubric@v1" }, flags: { rubricCritic: true } });
    });
});

describe("linkedinProvenance", () => {
    it("names the connection or follow-up prompt, with no critic or context", () => {
        expect(linkedinProvenance("connect")).toMatchObject({ node: "linkedin", prompts: { draft: "linkedin.connect@v1", critique: "none" }, critique: "unreviewed" });
        expect(linkedinProvenance("followUp").prompts.draft).toBe("linkedin.followUp@v1");
        expect(readProvenance(JSON.parse(JSON.stringify(linkedinProvenance("connect"))))).toEqual(linkedinProvenance("connect"));
    });
});

describe("screened drafts", () => {
    it("name the Jev screen instead of a critic prompt, for both email paths", () => {
        expect(JEV_SCREEN_REF).toBe("jev.screen@v1");
        expect(buildProvenance({ ...base, critique: "screened", rubricCritic: true })).toMatchObject({ critique: "screened", prompts: { critique: JEV_SCREEN_REF } });
        expect(legacyProvenance(false, { critique: "screened", rubricCritic: false })).toMatchObject({ critique: "screened", prompts: { critique: JEV_SCREEN_REF } });
    });
});
