import { promptRef } from "@/lib/promptRegistry";

// Which prompt versions and copy settings wrote an email, saved with the Email row so a reply or a
// positive outcome can be tied back to what produced it. Ids, versions, switches and counts only:
// never text, so nothing about a prospect or the private playbook ends up here.

export interface CopyProvenance {
    v: 1;
    // "A" is the composer; "legacy" is the older single-prompt email draft path; "linkedin" is a LinkedIn
    // connection note or follow-up. Only the composer has context; a critic runs only where noted.
    node: "A" | "legacy" | "linkedin";
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

// The older draft path (email-worker) has no retrieval or brief, and a critic only when LEGACY_CRITIC is
// on, so what it records is the prompt that wrote the email (and the critic, if it ran), to compare
// against the composer in copy:outcomes.
export function legacyProvenance(batch: boolean, review?: { critique: CopyProvenance["critique"]; rubricCritic: boolean }): CopyProvenance {
    return {
        v: 1,
        node: "legacy",
        prompts: {
            draft: promptRef(batch ? "email.legacyBatch" : "email.legacyDraft"),
            system: "none",
            critique: review ? promptRef(review.rubricCritic ? "email.critique.rubric" : "email.critique") : "none",
        },
        flags: { retrieval: false, brief: false, rubricCritic: review?.rubricCritic ?? false },
        context: { playbook: 0, examples: 0, brief: false },
        critique: review?.critique ?? "unreviewed",
    };
}

// A LinkedIn connection note or follow-up: one prompt, no critic, retrieval or brief.
export function linkedinProvenance(kind: "connect" | "followUp"): CopyProvenance {
    return {
        v: 1,
        node: "linkedin",
        prompts: { draft: promptRef(kind === "connect" ? "linkedin.connect" : "linkedin.followUp"), system: "none", critique: "none" },
        flags: { retrieval: false, brief: false, rubricCritic: false },
        context: { playbook: 0, examples: 0, brief: false },
        critique: "unreviewed",
    };
}

// Reads provenance back from a JSON column or a held approval, ignoring anything that is not ours.
export function readProvenance(value: unknown): CopyProvenance | null {
    if (typeof value !== "object" || value === null) return null;
    const p = value as Partial<CopyProvenance>;
    return p.v === 1 && (p.node === "A" || p.node === "legacy" || p.node === "linkedin") && p.prompts && p.flags && p.context && typeof p.critique === "string" ? (p as CopyProvenance) : null;
}
