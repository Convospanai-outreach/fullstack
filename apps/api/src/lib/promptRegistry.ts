import { createHash } from "node:crypto";

// Ids and versions for the prompts behind outbound copy, so an eval score or an A/B result can be
// tied to the exact prompt that produced it. The prompt text stays in its module; the registry
// holds only the id, a version and a fingerprint of the prompt as rendered for fixed placeholder
// input (see promptRegistry.test.ts). Change a prompt and the test fails until the fingerprint is
// updated here and the version is bumped, so a prompt cannot change without a new version.

export const PROMPT_REGISTRY = {
    "email.nodeA.system": { version: 1, fingerprint: "1be63dc5222f" },
    "email.nodeA": { version: 3, fingerprint: "3d3ab44a1f10" },
    "email.nodeB": { version: 2, fingerprint: "e8ba3a93fa99" },
    "email.nodeC": { version: 2, fingerprint: "188534d7f14d" },
    "email.legacyDraft": { version: 1, fingerprint: "9b37c1a1c58b" },
    "email.legacyBatch": { version: 1, fingerprint: "ff173ae4ec8c" },
    "linkedin.connect": { version: 1, fingerprint: "8b9a221db6fb" },
    "linkedin.followUp": { version: 1, fingerprint: "d61c09234756" },
    "email.critique": { version: 1, fingerprint: "bb39618e430e" },
    "email.critique.rubric": { version: 2, fingerprint: "84861b7fec57" },
} as const satisfies Record<string, { version: number; fingerprint: string }>;

export type PromptId = keyof typeof PROMPT_REGISTRY;

export function fingerprintPrompt(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

export function promptRef(id: PromptId): string {
    return `${id}@v${PROMPT_REGISTRY[id].version}`;
}

export function allPromptRefs(): Record<PromptId, string> {
    return Object.fromEntries((Object.keys(PROMPT_REGISTRY) as PromptId[]).map((id) => [id, promptRef(id)])) as Record<PromptId, string>;
}
