import { aiService } from "@/lib/aiService";

function extractJsonBlock(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
    const start = Math.min(
        ...["{", "["]
            .map((token) => trimmed.indexOf(token))
            .filter((idx) => idx !== -1)
    );
    if (Number.isFinite(start) && start >= 0) {
        const endBrace = trimmed.lastIndexOf("}");
        const endBracket = trimmed.lastIndexOf("]");
        const end = Math.max(endBrace, endBracket);
        if (end > start) return trimmed.slice(start, end + 1);
    }
    return trimmed;
}

export abstract class BaseAgent {
    protected teamId?: string;

    constructor(teamId?: string) {
        this.teamId = teamId;
    }

    protected async generateJSON<T>(prompt: string, schemaDescription: string, retries = 2): Promise<T> {
        const fullPrompt = `
You must respond with VALID JSON only.
Schema:
${schemaDescription}

Task:
${prompt}
        `.trim();

        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                const text = await aiService.askAI(fullPrompt, this.teamId);
                const json = JSON.parse(extractJsonBlock(text));
                return json as T;
            } catch (err) {
                lastError = err as Error;
            }
        }
        throw lastError || new Error("Failed to generate valid JSON response");
    }
}
