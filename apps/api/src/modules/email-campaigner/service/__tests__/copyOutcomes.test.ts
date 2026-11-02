import { describe, expect, it } from "vitest";
import { classifyReply, linkedinOutcomeRows, summarizeOutcomes } from "../copyOutcomes";
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

describe("reply classification", () => {
    it("lets a rep's correction win over the AI's suggestion", () => {
        expect(classifyReply({ aiClassification: "interested", humanCorrection: null })).toBe("INTERESTED");
        expect(classifyReply({ aiClassification: "INTERESTED", humanCorrection: "NOT_INTERESTED" })).toBe("NOT_INTERESTED");
    });

    it("counts interested and negative replies, and leaves questions and out-of-office as replies only", () => {
        const p = buildProvenance(base);
        const [group] = summarizeOutcomes(
            ["INTERESTED", "INTERESTED", "NOT_INTERESTED", "DNC", "QUESTION", "OOO", null].map((classification) => ({
                copyProvenance: p, openedAt: null, repliedAt: classification ? day : null, classification,
            })),
        );
        expect(group).toMatchObject({ sent: 7, replied: 6, interested: 2, negative: 2 });
    });
});

describe("linkedinOutcomeRows", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
    const p = { v: 1 };

    it("pairs a send with the lead's first reply before the next send, and carries the classification", () => {
        const rows = linkedinOutcomeRows(
            [{ leadId: "a", createdAt: at(1), copyProvenance: p }, { leadId: "a", createdAt: at(5), copyProvenance: p }, { leadId: "b", createdAt: at(1), copyProvenance: p }],
            [{ id: "r1", leadId: "a", createdAt: at(3) }, { id: "r2", leadId: "a", createdAt: at(4) }, { id: "r3", leadId: "a", createdAt: at(6) }],
            new Map([["r1", "INTERESTED"], ["r3", "DNC"]]),
        );
        expect(rows.map((r) => [r.repliedAt?.getUTCHours() ?? null, r.classification])).toEqual([[3, "INTERESTED"], [6, "DNC"], [null, null]]);
        expect(rows.every((r) => r.openedAt === null)).toBe(true);
    });

    it("ignores a reply that came before the send, or from another lead", () => {
        const [row] = linkedinOutcomeRows([{ leadId: "a", createdAt: at(5), copyProvenance: p }], [{ id: "r1", leadId: "a", createdAt: at(2) }, { id: "r2", leadId: "b", createdAt: at(6) }], new Map());
        expect(row.repliedAt).toBeNull();
    });
});
