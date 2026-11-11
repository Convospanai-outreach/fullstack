import { searchGold, situationText } from "@/modules/gold/goldSet";
import { searchPlaybook } from "@/modules/playbook/playbookStore";

// Optional extra context for the draft prompts: a few passages from the private playbook and a few
// gold examples of the same kind of situation. Off unless COPY_RETRIEVAL=on. When off, nothing is
// searched and the prompts are exactly what they were.
//
// The context goes only to the draft prompt, never onto the composer input: the critics serialize
// that input, and would then see (and judge against) text the draft was only meant to learn from.
//
// Searches use the platform teams that own the knowledge bases (PLAYBOOK_TEAM_ID, GOLD_TEAM_ID, the
// same names the sync scripts use), so the situation text is embedded with, and billed to, those
// teams' provider keys.

export interface CopyContext {
    playbook: string[];
    examples: { subject: string; body: string }[];
}

const MAX_PLAYBOOK = 3;
const MAX_EXAMPLES = 2;
const MAX_CHARS = 1200;
// A hit this close is almost certainly the same situation: an eval case that was also stored as a
// few-shot example would be handed its own answer.
const NEAR_DUPLICATE = 0.98;

export function retrievalEnabled(): boolean {
    return process.env["COPY_RETRIEVAL"] === "on";
}

const clip = (text: string) => (text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text);

export async function loadCopyContext(node: "A" | "B" | "C", input: Record<string, unknown>): Promise<CopyContext | null> {
    if (!retrievalEnabled()) return null;
    const query = situationText(input);
    const [playbook, gold] = await Promise.all([
        searchPlaybook(query, process.env["PLAYBOOK_TEAM_ID"], { limit: MAX_PLAYBOOK }),
        searchGold(input, node, process.env["GOLD_TEAM_ID"], { limit: MAX_EXAMPLES + 1 }),
    ]);
    const context: CopyContext = {
        playbook: playbook.map((h) => clip(h.content)),
        examples: gold.filter((h) => h.similarity < NEAR_DUPLICATE).slice(0, MAX_EXAMPLES).map((h) => ({ subject: clip(h.subject), body: clip(h.body) })),
    };
    return context.playbook.length || context.examples.length ? context : null;
}

// Empty when there is nothing to add, so a prompt without context is unchanged.
export function renderCopyContext(context?: CopyContext | null): string {
    if (!context) return "";
    const parts: string[] = [];
    if (context.playbook.length) {
        parts.push(`## PLAYBOOK GUIDANCE\nBackground on what works. Apply the ideas; do not quote them.\n${context.playbook.map((p) => `- ${p}`).join("\n")}`);
    }
    if (context.examples.length) {
        parts.push(
            `## EXAMPLES OF GOOD COPY\nThese were written for other prospects. Learn the structure and tone only. Never reuse their names, companies, numbers or claims; every fact in your email must come from the INPUT above.\n${context.examples
                .map((e, i) => `Example ${i + 1}\nSubject: ${e.subject}\nBody: ${e.body}`)
                .join("\n\n")}`,
        );
    }
    return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}
