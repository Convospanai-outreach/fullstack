import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertOutsideRepo } from "@/evals/copy/evalData";
import { searchKnowledgeBase, syncKnowledgeItems, type KbItem, type SyncResult } from "@/modules/playbook/playbookStore";

// The gold set is private: owner-written examples of good outreach, each with the situation it was
// written for. This repo holds only the loader, the sync and the search. The file is read from
// GOLD_DIR (outside the checkout).
//
// Two splits: "fewshot" examples are stored in the database and retrieved to show the generator what
// good looks like. "heldout" examples stay in the private folder and are never stored or retrieved,
// so the eval can score the generator on situations it has not been shown the answer to.

export const GOLD_KB_NAME = "CMF Gold Set";
export type GoldNode = "A" | "B" | "C";
export type GoldSplit = "fewshot" | "heldout";

export interface GoldExample {
    id: string;
    node: GoldNode;
    split: GoldSplit;
    // The same input the composer takes for this node (see NodeAInput / NodeBInput / NodeCInput).
    input: Record<string, unknown>;
    subject: string;
    body: string;
    notes?: string;
}

// The fields that describe the situation, and so what retrieval compares. Names, emails and the
// sender's style settings are left out on purpose: they would pull matches toward the same person
// or voice instead of the same kind of situation.
const SITUATION_FIELDS = ["prospect_title", "pain_context", "outreach_timing", "hypothesis", "signal_type", "extracted_signal", "original_subject", "original_body"];

export function situationText(input: Record<string, unknown>): string {
    return SITUATION_FIELDS
        .filter((field) => typeof input[field] === "string" && (input[field] as string).trim())
        .map((field) => `${field}: ${(input[field] as string).trim()}`)
        .join("\n");
}

function hashExample(e: GoldExample) {
    return createHash("sha256").update(JSON.stringify([e.id, e.node, e.input, e.subject, e.body])).digest("hex").slice(0, 16);
}

export function parseGold(raw: unknown): GoldExample[] {
    if (!Array.isArray(raw) || raw.length === 0) throw new Error("gold.json must be a non-empty list.");
    const seen = new Set<string>();
    const examples = raw.map((item, i) => {
        const e = item as Partial<GoldExample>;
        if (typeof e.id !== "string" || !e.id) throw new Error(`Example ${i}: id is required.`);
        if (seen.has(e.id)) throw new Error(`Example ${e.id}: duplicate id.`);
        seen.add(e.id);
        if (e.node !== "A" && e.node !== "B" && e.node !== "C") throw new Error(`Example ${e.id}: node must be A, B or C.`);
        if (e.split !== "fewshot" && e.split !== "heldout") throw new Error(`Example ${e.id}: split must be fewshot or heldout.`);
        if (typeof e.input !== "object" || e.input === null) throw new Error(`Example ${e.id}: input is required.`);
        if (typeof e.subject !== "string" || !e.subject.trim()) throw new Error(`Example ${e.id}: subject is required.`);
        if (typeof e.body !== "string" || !e.body.trim()) throw new Error(`Example ${e.id}: body is required.`);
        if (!situationText(e.input)) throw new Error(`Example ${e.id}: input has none of the situation fields (${SITUATION_FIELDS.join(", ")}).`);
        return { id: e.id, node: e.node, split: e.split, input: e.input as Record<string, unknown>, subject: e.subject.trim(), body: e.body.trim(), ...(typeof e.notes === "string" && e.notes.trim() ? { notes: e.notes.trim() } : {}) } as GoldExample;
    });

    // A held-out situation that also appears among the few-shot ones would let the eval grade an
    // answer the generator has already been shown.
    const shown = new Set(examples.filter((e) => e.split === "fewshot").map((e) => `${e.node}|${situationText(e.input)}`));
    for (const e of examples.filter((x) => x.split === "heldout")) {
        if (shown.has(`${e.node}|${situationText(e.input)}`)) throw new Error(`Example ${e.id}: held-out, but a few-shot example has the same situation. It would leak into the eval.`);
    }
    return examples;
}

export interface GoldSummary {
    total: number;
    fewshot: number;
    heldout: number;
    byNode: Record<GoldNode, number>;
    warning: string | null;
}

export function summarizeGold(examples: GoldExample[]): GoldSummary {
    const heldout = examples.filter((e) => e.split === "heldout").length;
    const share = heldout / examples.length;
    return {
        total: examples.length,
        fewshot: examples.length - heldout,
        heldout,
        byNode: { A: examples.filter((e) => e.node === "A").length, B: examples.filter((e) => e.node === "B").length, C: examples.filter((e) => e.node === "C").length },
        warning: examples.length >= 10 && (share < 0.15 || share > 0.35)
            ? `Held-out is ${Math.round(share * 100)}% of the examples; about 20% is the usual target.`
            : null,
    };
}

export function loadGold(dir: string | undefined, repoRoot?: string | null): GoldExample[] {
    if (!dir) throw new Error("Set GOLD_DIR to the private folder holding gold.json.");
    if (repoRoot === undefined) assertOutsideRepo(dir);
    else assertOutsideRepo(dir, repoRoot);
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(path.join(dir, "gold.json"), "utf8"));
    } catch (error: any) {
        throw new Error(`Could not read gold.json in ${dir}: ${error?.message || error}`);
    }
    return parseGold(raw);
}

// Only few-shot examples ever reach the database; passing a held-out one is refused.
export async function syncGold(examples: GoldExample[], teamId: string, options: { dryRun: boolean }): Promise<SyncResult<KbItem>> {
    const heldout = examples.find((e) => e.split !== "fewshot");
    if (heldout) throw new Error(`Example ${heldout.id} is held out and must not be stored.`);
    return syncKnowledgeItems(
        GOLD_KB_NAME,
        "Private gold examples of good outreach, used as few-shot examples.",
        examples.map((e) => ({
            hash: hashExample(e),
            content: situationText(e.input),
            metadata: { source: "gold", exampleId: e.id, node: e.node, subject: e.subject, body: e.body, ...(e.notes ? { notes: e.notes } : {}) },
            label: e.id,
        })),
        teamId,
        options,
    );
}

export interface GoldHit {
    exampleId: string;
    node: GoldNode;
    situation: string;
    subject: string;
    body: string;
    notes: string | null;
    similarity: number;
}

// The few-shot examples closest to this situation, for the same node. Returns nothing (never throws)
// when there is no gold set, no embedding key, or the search fails.
export async function searchGold(
    input: Record<string, unknown>,
    node: GoldNode,
    teamId: string | undefined,
    options: { limit?: number; minSimilarity?: number } = {},
): Promise<GoldHit[]> {
    const hits = await searchKnowledgeBase(GOLD_KB_NAME, situationText(input), teamId, {
        limit: options.limit ?? 3,
        ...(options.minSimilarity !== undefined ? { minSimilarity: options.minSimilarity } : {}),
        metadataEquals: { key: "node", value: node },
    });
    return hits
        .filter((h) => typeof h.metadata?.subject === "string" && typeof h.metadata?.body === "string")
        .map((h) => ({
            exampleId: String(h.metadata!.exampleId ?? h.id),
            node,
            situation: h.content,
            subject: h.metadata!.subject,
            body: h.metadata!.body,
            notes: typeof h.metadata!.notes === "string" ? h.metadata!.notes : null,
            similarity: h.similarity,
        }));
}
