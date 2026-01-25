import fs from 'fs';
import path from 'path';

interface RegionContext {
    region: string;
    phrase: string;
    explanation: string;
    risk_level: string;
}

const RAG_DB_PATH = path.join(process.cwd(), 'rag', 'india_context.jsonl');
let CACHED_DB: RegionContext[] | null = null;

function loadDatabase(): RegionContext[] {
    if (CACHED_DB) return CACHED_DB;

    try {
        const fileContent = fs.readFileSync(RAG_DB_PATH, 'utf-8');
        CACHED_DB = fileContent
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            })
            .filter((item): item is RegionContext => item !== null && item.region === 'IN');

        return CACHED_DB!;
    } catch (error) {
        console.error("Failed to load region context DB:", error);
        return [];
    }
}

/**
 * Deterministically retrieves relevant cultural context for input text.
 * Max Context Limit: Strictly controlled to avoid prompt injection or overflow.
 */
export function retrieveRegionContext(text: string, region: string = "IN"): string | null {
    if (region !== "IN") return null;

    const db = loadDatabase();
    const lowerText = text.toLowerCase();

    const matches = db.filter(item => lowerText.includes(item.phrase.toLowerCase()));

    if (matches.length === 0) return null;

    // Format as advisory context
    // "Cultural Context: 'phrase' means 'explanation'. 'phrase' means 'explanation'."
    const contextStrings = matches.map(m => `'${m.phrase}' means '${m.explanation}'`);
    const finalString = `Cultural Context: ${contextStrings.join('; ')}.`;

    // Strict length check (approx 250 tokens ~ 1000 chars safe upper bound)
    return finalString.slice(0, 1000);
}
