import type { EvalCase, Rubric } from "./evalData";
import { runCopyEval, type CaseResult, type DraftCopy, type EvalDeps } from "./runCopyEval";
import { scoreSlop, type SlopOptions } from "./slopScore";

// Runs the same cases through several variants of the copy engine (a prompt version, a rewrite pass,
// a provider and model) and compares them. Every variant is judged by the same judge and scored by
// the same rule-based slop score, so the numbers are comparable. The first variant is the baseline.

export interface Variant {
    id: string;
    generate: (testCase: EvalCase) => Promise<DraftCopy>;
}

export interface AbDeps {
    judge: EvalDeps["judge"];
    slop?: SlopOptions;
}

export interface AbCaseResult extends CaseResult {
    slop?: number;
}

export interface VariantSummary {
    cases: number;
    scored: number;
    failed: number;
    meanJudge: number | null;
    passRate: number | null;
    meanSlop: number | null;
}

export interface Tally {
    wins: number;
    losses: number;
    ties: number;
    meanDelta: number | null;
}

export interface Comparison {
    variant: string;
    baseline: string;
    // Cases where both variants produced and scored a draft. A failed case is left out, not zeroed.
    paired: number;
    // Judge: higher is better. Slop: lower is better, so a win is a lower score.
    judge: Tally;
    slop: Tally;
}

export interface AbReport {
    variants: Record<string, VariantSummary>;
    comparisons: Comparison[];
    results: Record<string, AbCaseResult[]>;
}

const round = (n: number) => Math.round(n * 100) / 100;
const mean = (values: number[]) => (values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null);

export function abPlan(cases: EvalCase[], variants: Variant[]) {
    // Per case per variant: one generate call and one judge call (the composer may add its own critique).
    return { cases: cases.length, variants: variants.length, modelCalls: cases.length * variants.length * 2 };
}

function tally(pairs: Array<[number, number]>, lowerIsBetter: boolean): Tally {
    let wins = 0, losses = 0, ties = 0;
    for (const [cand, base] of pairs) {
        if (cand === base) ties++;
        else if ((cand < base) === lowerIsBetter) wins++;
        else losses++;
    }
    return { wins, losses, ties, meanDelta: mean(pairs.map(([cand, base]) => cand - base)) };
}

export async function runAb(cases: EvalCase[], rubric: Rubric, variants: Variant[], deps: AbDeps): Promise<AbReport> {
    if (variants.length === 0) throw new Error("Give at least one variant.");
    const ids = new Set<string>();
    for (const v of variants) {
        if (ids.has(v.id)) throw new Error(`Variant ${v.id}: duplicate id.`);
        ids.add(v.id);
    }

    const results: Record<string, AbCaseResult[]> = {};
    const summaries: Record<string, VariantSummary> = {};
    for (const v of variants) {
        const report = await runCopyEval(cases, rubric, { generate: v.generate, judge: deps.judge });
        const rows: AbCaseResult[] = report.results.map((r) => (r.draft && r.weighted !== undefined ? { ...r, slop: scoreSlop(r.draft, deps.slop).score } : r));
        results[v.id] = rows;
        const scored = rows.filter((r) => r.slop !== undefined);
        summaries[v.id] = {
            cases: rows.length,
            scored: scored.length,
            failed: rows.length - scored.length,
            meanJudge: mean(scored.map((r) => r.weighted!)),
            passRate: scored.length ? round(scored.filter((r) => r.passed).length / scored.length) : null,
            meanSlop: mean(scored.map((r) => r.slop!)),
        };
    }

    const baseline = variants[0]!.id;
    const baseRows = new Map(results[baseline]!.map((r) => [r.id, r]));
    const comparisons: Comparison[] = variants.slice(1).map((v) => {
        const pairs = results[v.id]!.flatMap((r) => {
            const b = baseRows.get(r.id);
            return r.slop !== undefined && b?.slop !== undefined ? [{ cand: r, base: b }] : [];
        });
        return {
            variant: v.id,
            baseline,
            paired: pairs.length,
            judge: tally(pairs.map((p) => [p.cand.weighted!, p.base.weighted!]), false),
            slop: tally(pairs.map((p) => [p.cand.slop!, p.base.slop!]), true),
        };
    });

    return { variants: summaries, comparisons, results };
}
