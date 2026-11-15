import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The eval set and rubric are private: this repo is public, so only the loader lives here.
// They are read from EVAL_DATA_DIR, which must sit outside the checkout.

export type CopyNode = "A" | "B" | "C";
export type EvalSplit = "dev" | "heldout";

export interface EvalCase {
    id: string;
    node: CopyNode;
    split: EvalSplit;
    // Passed unchanged to composeNodeA / B / C.
    input: Record<string, unknown>;
}

export interface RubricCriterion {
    id: string;
    description: string;
    weight: number;
}

export interface Rubric {
    criteria: RubricCriterion[];
    // A case passes when its weighted score (1 to 5) is at least this.
    passScore: number;
}

export interface EvalData {
    cases: EvalCase[];
    rubric: Rubric;
}

function findRepoRoot(from: string): string | null {
    let dir = from;
    for (;;) {
        if (fs.existsSync(path.join(dir, ".git"))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

export function assertOutsideRepo(dir: string, repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)))) {
    if (!repoRoot) return;
    const rel = path.relative(repoRoot, path.resolve(dir));
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
        throw new Error("EVAL_DATA_DIR is inside the repository. The eval set and rubric are private; keep them outside the checkout.");
    }
}

function readJson(file: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error: any) {
        throw new Error(`Could not read ${file}: ${error?.message || error}`);
    }
}

export function parseCases(raw: unknown): EvalCase[] {
    if (!Array.isArray(raw) || raw.length === 0) throw new Error("cases.json must be a non-empty list.");
    const seen = new Set<string>();
    return raw.map((item, i) => {
        const c = item as Partial<EvalCase>;
        if (typeof c.id !== "string" || !c.id) throw new Error(`Case ${i}: id is required.`);
        if (seen.has(c.id)) throw new Error(`Case ${c.id}: duplicate id.`);
        seen.add(c.id);
        if (c.node !== "A" && c.node !== "B" && c.node !== "C") throw new Error(`Case ${c.id}: node must be A, B or C.`);
        if (c.split !== "dev" && c.split !== "heldout") throw new Error(`Case ${c.id}: split must be dev or heldout.`);
        if (typeof c.input !== "object" || c.input === null) throw new Error(`Case ${c.id}: input is required.`);
        return { id: c.id, node: c.node, split: c.split, input: c.input as Record<string, unknown> };
    });
}

export function parseRubric(raw: unknown): Rubric {
    const r = raw as Partial<Rubric>;
    if (!r || !Array.isArray(r.criteria) || r.criteria.length === 0) throw new Error("rubric.json needs a non-empty criteria list.");
    const ids = new Set<string>();
    for (const c of r.criteria) {
        if (typeof c?.id !== "string" || !c.id || typeof c.description !== "string" || !c.description) {
            throw new Error("Every rubric criterion needs an id and a description.");
        }
        if (ids.has(c.id)) throw new Error(`Rubric criterion ${c.id}: duplicate id.`);
        ids.add(c.id);
        if (typeof c.weight !== "number" || !(c.weight > 0)) throw new Error(`Rubric criterion ${c.id}: weight must be a positive number.`);
    }
    if (typeof r.passScore !== "number" || r.passScore < 1 || r.passScore > 5) throw new Error("rubric passScore must be between 1 and 5.");
    return r as Rubric;
}

export function loadEvalData(dir: string | undefined, repoRoot?: string | null): EvalData {
    if (!dir) throw new Error("Set EVAL_DATA_DIR to the private folder holding cases.json and rubric.json.");
    if (repoRoot === undefined) assertOutsideRepo(dir);
    else assertOutsideRepo(dir, repoRoot);
    return {
        cases: parseCases(readJson(path.join(dir, "cases.json"))),
        rubric: parseRubric(readJson(path.join(dir, "rubric.json"))),
    };
}
