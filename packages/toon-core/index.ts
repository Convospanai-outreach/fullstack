export interface TOONCoreResult {
    optimizedPrompt: string;
    estimatedCost: number;
}

export function runTOONCore(sterilizedPrompt: string): TOONCoreResult {
    const optimizedPrompt = compressPrompt(sterilizedPrompt);
    const estimatedCost = estimatePromptCost(optimizedPrompt);
    return { optimizedPrompt, estimatedCost };
}

export function estimatePromptCost(prompt: string): number {
    const estimatedTokens = Math.ceil(prompt.length / 4);
    return (estimatedTokens / 1000) * 0.02;
}

export function serializeTabularData(data: unknown): string {
    if (Array.isArray(data)) {
        if (data.length === 0) return "[]";
        const first = data[0];
        if (typeof first === "object" && first !== null && !Array.isArray(first)) {
            const keys = Object.keys(first as Record<string, unknown>);
            const header = `[${keys.join(",")}]`;
            const rows = data.map((item) => {
                const record = item as Record<string, unknown>;
                const values = keys.map((key) => {
                    const value = record[key];
                    return typeof value === "string" ? `"${value}"` : String(value);
                });
                return `(${values.join(",")})`;
            });
            return `${header}${rows.join("")}`;
        }
        return `[${data.map((item) => serializeTabularData(item)).join(",")}]`;
    }

    if (typeof data === "object" && data !== null) {
        const parts = Object.entries(data as Record<string, unknown>).map(
            ([key, value]) => `${key}:${serializeTabularData(value)}`
        );
        return `{${parts.join(",")}}`;
    }

    return String(data);
}

function compressPrompt(text: string): string {
    let compressed = text
        .replace(/\s+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .replace(/Please provide a detailed response for/gi, "Analyze")
        .trim();

    if (compressed.length > 1500) {
        compressed = compressed
            .replace(/\b(the|is|at|which|on)\b/gi, "")
            .replace(/\s+/g, " ");
    }

    return compressed;
}
