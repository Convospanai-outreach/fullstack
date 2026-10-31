import { createHash } from "node:crypto";

// Ids and versions for the prompts behind outbound copy, so an eval score or an A/B result can be
// tied to the exact prompt that produced it. The prompt text stays in its module; the registry
// holds only the id, a version and a fingerprint of the prompt as rendered for fixed placeholder
// input (see promptRegistry.test.ts). Change a prompt and the test fails until the fingerprint is
// updated here and the version is bumped, so a prompt cannot change without a new version.

export const PROMPT_REGISTRY = {
    "email.nodeA.system": { version: 1, fingerprint: "1be63dc5222f" },
    "email.nodeA": { version: 1, fingerprint: "bedbe1bef4fa" },
    "email.nodeB": { version: 1, fingerprint: "f9ca7bb0c55c" },
    "email.nodeC": { version: 1, fingerprint: "c9c11f315b68" },
    "email.critique": { version: 1, fingerprint: "bb39618e430e" },
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
