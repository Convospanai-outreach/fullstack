import { createHash } from "node:crypto";

// Ids and versions for the prompts behind outbound copy, so an eval score or an A/B result can be
// tied to the exact prompt that produced it. The prompt text stays in its module; the registry
// holds only the id, a version and a fingerprint of the prompt as rendered for fixed placeholder
// input (see promptRegistry.test.ts). Change a prompt and the test fails until the fingerprint is
// updated here and the version is bumped, so a prompt cannot change without a new version.

export const PROMPT_REGISTRY = {
    "email.nodeA.system": { version: 2, fingerprint: "f508e4a9eeb0" },
    "email.nodeA": { version: 5, fingerprint: "a491eb40ae8e" },
    "email.nodeB": { version: 4, fingerprint: "e103f5e1ba77" },
    "email.nodeC": { version: 4, fingerprint: "e6670d86b585" },
    "email.legacyDraft": { version: 3, fingerprint: "702bf844c49e" },
    "email.legacyBatch": { version: 3, fingerprint: "a9864ce234ad" },
    "linkedin.connect": { version: 3, fingerprint: "b2402a936226" },
    "linkedin.followUp": { version: 3, fingerprint: "d58f28229466" },
    "linkedin.critique": { version: 2, fingerprint: "3748d88f7d9c" },
    "email.critique": { version: 3, fingerprint: "fe89a801b0a2" },
    "email.critique.rubric": { version: 4, fingerprint: "b3577f822fcc" },
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
