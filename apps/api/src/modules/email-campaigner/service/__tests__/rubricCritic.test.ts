import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Rubric } from "@/evals/copy/evalData";
import { buildRubricCritiquePrompt, loadCriticRubric, readRubricVerdict } from "../rubricCritic";

// Placeholder text only: the real rubric is private and never lives in the repo.
const rubric: Rubric = {
    criteria: [
        { id: "crit-a", description: "desc-a", weight: 3 },
        { id: "crit-b", description: "desc-b", weight: 1 },
    ],
    passScore: 4,
};
const reply = (over: Record<string, unknown> = {}) => ({ scores: { "crit-a": 5, "crit-b": 5 }, blockers: [], critique: "fine", correction: null, ...over });
const fix = { subject: "s2", body: "b2" };

afterEach(() => vi.restoreAllMocks());

describe("buildRubricCritiquePrompt", () => {
    it("lists the rubric, the blockers, the situation and the pass score", () => {
        const prompt = buildRubricCritiquePrompt({ extracted_signal: "signal-x" }, { subject: "subj", body: "body" }, rubric, "style-x");
        expect(prompt).toContain("- crit-a: desc-a");
        expect(prompt).toContain('"crit-b": <1-5>');
        expect(prompt).toContain("hallucination");
        expect(prompt).toContain("masking");
        expect(prompt).toContain("{extracted_signal:signal-x}");
        expect(prompt).toContain("below 4");
        expect(prompt).toContain("Subject: subj");
    });
});

describe("readRubricVerdict", () => {
    it("passes when the weighted score reaches the pass score and no blocker applies", () => {
        expect(readRubricVerdict(reply(), rubric)).toMatchObject({ status: "PASS", weighted: 5, blockers: [] });
        // (4*3 + 4*1) / 4 = 4, exactly the pass score.
        expect(readRubricVerdict(reply({ scores: { "crit-a": 4, "crit-b": 4 } }), rubric).status).toBe("PASS");
    });

    it("fails below the pass score, weighting the criteria", () => {
        // (3*3 + 5*1) / 4 = 3.5
        const v = readRubricVerdict(reply({ scores: { "crit-a": 3, "crit-b": 5 }, correction: fix }), rubric);
        expect(v).toMatchObject({ status: "FAIL", weighted: 3.5, correction: fix });
    });

    it("fails on a blocker even with top scores", () => {
        expect(readRubricVerdict(reply({ blockers: ["hallucination"] }), rubric)).toMatchObject({ status: "FAIL", blockers: ["hallucination"] });
    });

    it("leaves out a correction that is missing a field", () => {
        const v = readRubricVerdict(reply({ scores: { "crit-a": 1, "crit-b": 1 }, correction: { subject: "only subject" } }), rubric);
        expect(v.status).toBe("FAIL");
        expect(v.correction).toBeUndefined();
    });

    it("rejects a reply that skips a criterion, scores out of range, or has no blockers list", () => {
        expect(() => readRubricVerdict(reply({ scores: { "crit-a": 5 } }), rubric)).toThrow(/crit-b/);
        expect(() => readRubricVerdict(reply({ scores: { "crit-a": 6, "crit-b": 5 } }), rubric)).toThrow(/crit-a/);
        expect(() => readRubricVerdict(reply({ blockers: undefined }), rubric)).toThrow(/blockers/);
        expect(() => readRubricVerdict(reply({ blockers: [1] }), rubric)).toThrow(/blockers/);
        expect(() => readRubricVerdict(null, rubric)).toThrow();
    });
});

describe("loadCriticRubric", () => {
    const noRepo = path.join(os.tmpdir(), "no-such-repo");
    const dirWith = (content: string) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "critic-"));
        fs.writeFileSync(path.join(dir, "rubric.json"), content);
        return dir;
    };

    it("is off when no folder is set", () => {
        expect(loadCriticRubric(undefined, noRepo)).toBeNull();
    });

    it("reads rubric.json from the folder", () => {
        const dir = dirWith(JSON.stringify(rubric));
        expect(loadCriticRubric(dir, noRepo)).toEqual(rubric);
        fs.rmSync(dir, { recursive: true });
    });

    it("falls back to the standard critique, with a warning, for a folder inside the repo, a missing file or a bad rubric", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const dir = dirWith(JSON.stringify(rubric));
        expect(loadCriticRubric(dir, dir)).toBeNull();
        expect(loadCriticRubric(path.join(dir, "missing"), noRepo)).toBeNull();
        const bad = dirWith(JSON.stringify({ criteria: [], passScore: 4 }));
        expect(loadCriticRubric(bad, noRepo)).toBeNull();
        expect(warn).toHaveBeenCalledTimes(3);
        fs.rmSync(dir, { recursive: true });
        fs.rmSync(bad, { recursive: true });
    });
});
