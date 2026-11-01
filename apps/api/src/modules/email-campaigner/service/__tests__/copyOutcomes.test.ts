import { describe, expect, it } from "vitest";
import { summarizeOutcomes } from "../copyOutcomes";
import { buildProvenance } from "../copyProvenance";

const base = { retrievalOn: false, briefOn: false, rubricCritic: false, playbook: 0, examples: 0, briefUsed: false, critique: "passed" as const };
const day = new Date("2026-01-01");

describe("summarizeOutcomes", () => {
    it("groups by prompt version, critic, critique outcome and switches, and counts opens and replies", () => {
        const plain = buildProvenance(base);
        const withRetrieval = buildProvenance({ ...base, retrievalOn: true, playbook: 2 });
        const groups = summarizeOutcomes([
            { copyProvenance: plain, openedAt: day, repliedAt: null },
            { copyProvenance: plain, openedAt: day, repliedAt: day },
            { copyProvenance: plain, openedAt: null, repliedAt: null },
            { copyProvenance: withRetrieval, openedAt: null, repliedAt: day },
        ]);
        expect(groups).toHaveLength(2);
        expect(groups[0]).toMatchObject({ sent: 3, opened: 2, replied: 1 });
        expect(groups[0].key).toContain("email.nodeA@v3");
        expect(groups[0].key).toContain("flags: none");
        expect(groups[1]).toMatchObject({ sent: 1, opened: 0, replied: 1 });
        expect(groups[1].key).toContain("flags: retrieval");
    });

    it("skips rows with no readable provenance", () => {
        expect(summarizeOutcomes([{ copyProvenance: null, openedAt: null, repliedAt: null }, { copyProvenance: { v: 2 }, openedAt: null, repliedAt: null }])).toEqual([]);
    });
});
