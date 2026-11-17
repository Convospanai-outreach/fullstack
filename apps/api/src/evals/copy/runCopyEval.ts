import type { EvalCase, EvalSplit, Rubric } from "./evalData";

export interface DraftCopy {
    subject: string;
    body: string;
}

export interface JudgeResult {
    scores: Record<string, number>;
    notes: string;
}

export interface CaseResult {
    id: string;
    node: string;
    split: EvalSplit;
    draft?: DraftCopy;
    scores?: Record<string, number>;
    weighted?: number;
    passed?: boolean;
    notes?: string;
    error?: string;
}

export interface SplitSummary {
    cases: number;
    scored: number;
    failed: number;
    meanScore: number | null;
    passRate: number | null;
    perCriterion: Record<string, number>;
}

export interface CopyEvalReport {
    summary: Record<EvalSplit, SplitSummary>;
    results: CaseResult[];
}

export interface EvalDeps {
    generate: (testCase: EvalCase) => Promise<DraftCopy>;
    judge: (testCase: EvalCase, draft: DraftCopy, rubric: Rubric) => Promise<JudgeResult>;
}

// The judge prompt is built from the private rubric; only the scaffolding lives here.
export function buildJudgePrompt(testCase: EvalCase, draft: DraftCopy, rubric: Rubric): string {
    const criteria = rubric.criteria.map((c) => `- ${c.id}: ${c.description}`).join("\n");
    return [
        "You are grading one outbound sales message against a rubric. Score each criterion from 1 (poor) to 5 (excellent).",
        "Judge only the message and the situation it was written for. Do not reward length.",
        "",
        "Rubric:",
        criteria,
        "",
        "Situation the message was written for (JSON):",
        JSON.stringify(testCase.input),
        "",
        "Message:",
        `Subject: ${draft.subject}`,
        draft.body,
        "",
        `Reply with JSON only: {"scores": {${rubric.criteria.map((c) => `"${c.id}": <1-5>`).join(", ")}}, "notes": "<one or two sentences>"}`,
    ].join("\n");
}

// Rejects a reply that skips a criterion or gives a score outside 1 to 5, so a bad judge reply is
// an error on that case instead of a silent zero.
export function parseJudgeReply(raw: unknown, rubric: Rubric): JudgeResult {
    const reply = raw as { scores?: Record<string, unknown>; notes?: unknown } | null;
    if (!reply || typeof reply.scores !== "object" || reply.scores === null) throw new Error("Judge reply has no scores.");
    const scores: Record<string, number> = {};
    for (const c of rubric.criteria) {
        const value = reply.scores[c.id];
        if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5) {
            throw new Error(`Judge gave no valid 1 to 5 score for ${c.id}.`);
        }
        scores[c.id] = value;
    }
    return { scores, notes: typeof reply.notes === "string" ? reply.notes : "" };
}

export function weightedScore(scores: Record<string, number>, rubric: Rubric): number {
    const total = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    return rubric.criteria.reduce((sum, c) => sum + (scores[c.id] ?? 0) * c.weight, 0) / total;
}

function round(n: number) {
    return Math.round(n * 100) / 100;
}

function summarize(results: CaseResult[], rubric: Rubric): SplitSummary {
    const scored = results.filter((r) => r.weighted !== undefined);
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    return {
        cases: results.length,
        scored: scored.length,
        failed: results.length - scored.length,
        meanScore: scored.length ? round(mean(scored.map((r) => r.weighted!))) : null,
        passRate: scored.length ? round(scored.filter((r) => r.passed).length / scored.length) : null,
        perCriterion: scored.length
            ? Object.fromEntries(rubric.criteria.map((c) => [c.id, round(mean(scored.map((r) => r.scores![c.id])))]))
            : {},
    };
}

// Runs the cases one at a time (each call spends credits) and never stops on a failed case: an
// error is recorded on that case and counted in `failed`, not folded into the mean.
export async function runCopyEval(cases: EvalCase[], rubric: Rubric, deps: EvalDeps): Promise<CopyEvalReport> {
    const results: CaseResult[] = [];
    for (const testCase of cases) {
        const base: CaseResult = { id: testCase.id, node: testCase.node, split: testCase.split };
        try {
            const draft = await deps.generate(testCase);
            const judged = await deps.judge(testCase, draft, rubric);
            const weighted = round(weightedScore(judged.scores, rubric));
            results.push({ ...base, draft, scores: judged.scores, weighted, passed: weighted >= rubric.passScore, notes: judged.notes });
        } catch (error: any) {
            results.push({ ...base, error: error?.message || String(error) });
        }
    }
    return {
        summary: {
            dev: summarize(results.filter((r) => r.split === "dev"), rubric),
            heldout: summarize(results.filter((r) => r.split === "heldout"), rubric),
        },
        results,
    };
}
