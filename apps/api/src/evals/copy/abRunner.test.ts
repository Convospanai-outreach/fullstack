import { describe, expect, it } from "vitest";
import type { EvalCase, Rubric } from "./evalData";
import { abPlan, runAb, type Variant } from "./abRunner";

// Placeholder data only: the real eval set and rubric are private.
const rubric: Rubric = { criteria: [{ id: "q", description: "quality", weight: 1 }], passScore: 3.5 };
const cases: EvalCase[] = ["c1", "c2", "c3"].map((id) => ({ id, node: "A", split: "dev", input: { id } }));

// The fake judge scores by marker words in the body, so each variant's quality is known up front.
const judge = async (_c: EvalCase, draft: { subject: string; body: string }) => ({
    scores: { q: draft.body.includes("great") ? 5 : draft.body.includes("ok") ? 3 : 1 },
    notes: "",
});

const variant = (id: string, body: (c: EvalCase) => string): Variant => ({
    id,
    generate: async (c) => ({ subject: "s", body: body(c) }),
});

describe("abPlan", () => {
    it("counts a generate and a judge call per case per variant", () => {
        expect(abPlan(cases, [variant("a", () => ""), variant("b", () => "")])).toEqual({ cases: 3, variants: 2, modelCalls: 12 });
    });
});

describe("runAb", () => {
    it("summarises each variant and compares the others with the first", async () => {
        const base = variant("base", () => "ok. I hope this finds you well!");
        const better = variant("better", () => "great plain note");
        const report = await runAb(cases, rubric, [base, better], { judge });

        expect(report.variants["base"]!.meanJudge).toBe(3);
        expect(report.variants["better"]!.meanJudge).toBe(5);
        expect(report.variants["base"]!.meanSlop).toBeGreaterThan(report.variants["better"]!.meanSlop!);

        expect(report.comparisons).toHaveLength(1);
        const cmp = report.comparisons[0]!;
        expect(cmp).toMatchObject({ variant: "better", baseline: "base", paired: 3 });
        expect(cmp.judge).toEqual({ wins: 3, losses: 0, ties: 0, meanDelta: 2 });
        // Lower slop is better, so the clean variant wins every case.
        expect(cmp.slop.wins).toBe(3);
        expect(cmp.slop.meanDelta).toBeLessThan(0);
    });

    it("runs every variant on the same cases", async () => {
        const seen: Record<string, string[]> = { a: [], b: [] };
        const make = (id: string) => ({ id, generate: async (c: EvalCase) => { seen[id]!.push(c.id); return { subject: "s", body: "ok" }; } });
        await runAb(cases, rubric, [make("a"), make("b")], { judge });
        expect(seen["a"]).toEqual(["c1", "c2", "c3"]);
        expect(seen["b"]).toEqual(["c1", "c2", "c3"]);
    });

    it("records a failed case and leaves it out of the pairing instead of counting a zero", async () => {
        const flaky: Variant = {
            id: "flaky",
            generate: async (c) => {
                if (c.id === "c2") throw new Error("provider down");
                return { subject: "s", body: "great" };
            },
        };
        const report = await runAb(cases, rubric, [variant("base", () => "ok"), flaky], { judge });
        expect(report.variants["flaky"]).toMatchObject({ scored: 2, failed: 1 });
        expect(report.variants["flaky"]!.meanJudge).toBe(5);
        expect(report.comparisons[0]!.paired).toBe(2);
        expect(report.results["flaky"]!.find((r) => r.id === "c2")!.error).toMatch(/provider down/);
    });

    it("passes private slop phrases through to the scorer", async () => {
        const report = await runAb(cases, rubric, [variant("a", () => "ok best-in-class")], { judge, slop: { extraPhrases: ["best-in-class"] } });
        expect(report.variants["a"]!.meanSlop).toBe(15);
    });

    it("rejects an empty or duplicate variant list", async () => {
        await expect(runAb(cases, rubric, [], { judge })).rejects.toThrow(/at least one/);
        await expect(runAb(cases, rubric, [variant("a", () => ""), variant("a", () => "")], { judge })).rejects.toThrow(/duplicate/);
    });
});
