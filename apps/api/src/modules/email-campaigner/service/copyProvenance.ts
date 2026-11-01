import { promptRef } from "@/lib/promptRegistry";

// Which prompt versions and copy settings wrote an email, saved with the Email row so a reply or a
// positive outcome can be tied back to what produced it. Ids, versions, switches and counts only:
// never text, so nothing about a prospect or the private playbook ends up here.

export interface CopyProvenance {
    v: 1;
    // "A" is the composer; "legacy" is the older single-prompt draft path, which has no critic or context.
    node: "A" | "legacy";
    prompts: { draft: string; system: string; critique: string };
    flags: { retrieval: boolean; brief: boolean; rubricCritic: boolean };
    // How much extra context the draft prompt actually received.
    context: { playbook: number; examples: number; brief: boolean };
    // passed: the critic accepted it. corrected: the critic's rewrite was used. unreviewed: no usable verdict.
    critique: "passed" | "corrected" | "unreviewed";
}

export function buildProvenance(input: {
    retrievalOn: boolean;
    briefOn: boolean;
    rubricCritic: boolean;
    playbook: number;
    examples: number;
    briefUsed: boolean;
    critique: CopyProvenance["critique"];
}): CopyProvenance {
    return {
        v: 1,
        node: "A",
        prompts: {
            draft: promptRef("email.nodeA"),
            system: promptRef("email.nodeA.system"),
            critique: promptRef(input.rubricCritic ? "email.critique.rubric" : "email.critique"),
        },
        flags: { retrieval: input.retrievalOn, brief: input.briefOn, rubricCritic: input.rubricCritic },
        context: { playbook: input.playbook, examples: input.examples, brief: input.briefUsed },
        critique: input.critique,
    };
}

// The older draft path (email-worker) has no critic, retrieval or brief, so what it records is the
// prompt that wrote the email, to compare against the composer in copy:outcomes.
export function legacyProvenance(batch: boolean): CopyProvenance {
    return {
        v: 1,
        node: "legacy",
        prompts: { draft: promptRef(batch ? "email.legacyBatch" : "email.legacyDraft"), system: "none", critique: "none" },
        flags: { retrieval: false, brief: false, rubricCritic: false },
        context: { playbook: 0, examples: 0, brief: false },
        critique: "unreviewed",
    };
}

// Reads provenance back from a JSON column or a held approval, ignoring anything that is not ours.
export function readProvenance(value: unknown): CopyProvenance | null {
    if (typeof value !== "object" || value === null) return null;
    const p = value as Partial<CopyProvenance>;
    return p.v === 1 && (p.node === "A" || p.node === "legacy") && p.prompts && p.flags && p.context && typeof p.critique === "string" ? (p as CopyProvenance) : null;
}
