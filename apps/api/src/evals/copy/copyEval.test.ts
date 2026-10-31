import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertOutsideRepo, loadEvalData, parseCases, parseRubric, type EvalCase, type Rubric } from "./evalData";
import { buildJudgePrompt, parseJudgeReply, runCopyEval, weightedScore } from "./runCopyEval";

// Placeholder data only: the real eval set and rubric are private and never live in the repo.
const rubric: Rubric = {
    criteria: [
        { id: "alpha", description: "first thing", weight: 1 },
        { id: "beta", description: "second thing", weight: 3 },
    ],
    passScore: 3.5,
};
const makeCase = (id: string, split: "dev" | "heldout"): EvalCase => ({ id, node: "A", split, input: { prospect_name: "X" } });

describe("eval data", () => {
    it("accepts well-formed cases and rubric", () => {
        expect(parseCases([{ id: "c1", node: "B", split: "dev", input: {} }])).toHaveLength(1);
        expect(parseRubric(rubric)).toEqual(rubric);
    });

    it("rejects duplicate ids, unknown nodes or splits, and bad rubric values", () => {
        expect(() => parseCases([])).toThrow(/non-empty/);
        expect(() => parseCases([makeCase("c1", "dev"), makeCase("c1", "dev")])).toThrow(/duplicate/);
        expect(() => parseCases([{ id: "c1", node: "Z", split: "dev", input: {} }])).toThrow(/node/);
        expect(() => parseCases([{ id: "c1", node: "A", split: "train", input: {} }])).toThrow(/split/);
        expect(() => parseRubric({ ...rubric, passScore: 9 })).toThrow(/passScore/);
        expect(() => parseRubric({ ...rubric, criteria: [{ id: "a", description: "d", weight: 0 }] })).toThrow(/weight/);
    });

    it("refuses a data directory inside the repository", () => {
        const repo = path.join(os.tmpdir(), "fake-repo");
        expect(() => assertOutsideRepo(path.join(repo, "evals"), repo)).toThrow(/inside the repository/);
        expect(() => assertOutsideRepo(repo, repo)).toThrow(/inside the repository/);
        expect(() => assertOutsideRepo(path.join(os.tmpdir(), "elsewhere"), repo)).not.toThrow();
    });

    it("needs EVAL_DATA_DIR, and loads both files from it", () => {
        expect(() => loadEvalData(undefined)).toThrow(/EVAL_DATA_DIR/);
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-data-"));
        fs.writeFileSync(path.join(dir, "cases.json"), JSON.stringify([{ id: "c1", node: "A", split: "heldout", input: {} }]));
        fs.writeFileSync(path.join(dir, "rubric.json"), JSON.stringify(rubric));
        expect(loadEvalData(dir).cases[0].split).toBe("heldout");
        fs.rmSync(dir, { recursive: true });
    });
});

describe("judging", () => {
    it("weights criteria", () => {
        expect(weightedScore({ alpha: 5, beta: 1 }, rubric)).toBe(2);
    });

    it("turns the rubric into the judge prompt and asks for every criterion", () => {
        const prompt = buildJudgePrompt(makeCase("c1", "dev"), { subject: "S", body: "B" }, rubric);
        expect(prompt).toContain("alpha: first thing");
        expect(prompt).toContain('"beta": <1-5>');
        expect(prompt).toContain("Subject: S");
    });

    it("rejects a judge reply that skips a criterion or scores out of range", () => {
        expect(parseJudgeReply({ scores: { alpha: 4, beta: 5 }, notes: "ok" }, rubric).scores).toEqual({ alpha: 4, beta: 5 });
        expect(() => parseJudgeReply({ scores: { alpha: 4 } }, rubric)).toThrow(/beta/);
        expect(() => parseJudgeReply({ scores: { alpha: 4, beta: 6 } }, rubric)).toThrow(/beta/);
        expect(() => parseJudgeReply(null, rubric)).toThrow(/no scores/);
    });
});

describe("runCopyEval", () => {
    it("reports dev and held-out separately, with pass rate and per-criterion means", async () => {
        const cases = [makeCase("d1", "dev"), makeCase("d2", "dev"), makeCase("h1", "heldout")];
        const scoreFor: Record<string, number> = { d1: 5, d2: 1, h1: 4 };
        const report = await runCopyEval(cases, rubric, {
            generate: async () => ({ subject: "s", body: "b" }),
            judge: async (c) => ({ scores: { alpha: scoreFor[c.id], beta: scoreFor[c.id] }, notes: "" }),
        });

        expect(report.summary.dev).toMatchObject({ cases: 2, scored: 2, failed: 0, meanScore: 3, passRate: 0.5 });
        expect(report.summary.dev.perCriterion).toEqual({ alpha: 3, beta: 3 });
        expect(report.summary.heldout).toMatchObject({ cases: 1, meanScore: 4, passRate: 1 });
    });

    it("records a failed case and keeps going, without counting it as a zero", async () => {
        const cases = [makeCase("d1", "dev"), makeCase("d2", "dev")];
        const report = await runCopyEval(cases, rubric, {
            generate: async (c) => {
                if (c.id === "d1") throw new Error("provider down");
                return { subject: "s", body: "b" };
            },
            judge: async () => ({ scores: { alpha: 4, beta: 4 }, notes: "" }),
        });

        expect(report.results[0]).toMatchObject({ id: "d1", error: "provider down" });
        expect(report.summary.dev).toMatchObject({ cases: 2, scored: 1, failed: 1, meanScore: 4 });
    });

    it("gives null scores for a split with nothing scored", async () => {
        const report = await runCopyEval([makeCase("d1", "dev")], rubric, {
            generate: async () => { throw new Error("x"); },
            judge: async () => ({ scores: {}, notes: "" }),
        });
        expect(report.summary.dev.meanScore).toBeNull();
        expect(report.summary.heldout).toMatchObject({ cases: 0, meanScore: null, passRate: null });
    });
});
