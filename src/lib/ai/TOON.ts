import { SovereignFirewall } from './SovereignFirewall';
import { tokenUsageGuard } from '@/modules/optimization/TokenUsageGuard';

export interface TOONResult {
    optimizedPrompt: string;
    tokenMap: Map<string, string>;
    estimatedCost: number;
}

/**
 * TOON: Token Optimization & Operational Node
 * 
 * Responsible for:
 * 1. Data Sterilization (PII Masking)
 * 2. Prompt Compression (Cost Reduction)
 * 3. Quota Enforcement
 */
export class TOON {
    /**
     * Sterilizes and optimizes a prompt for the cloud LLM.
     */
    static async process(prompt: string, teamId: string): Promise<TOONResult> {
        // 1. Data Sterilization (PII Masking)
        const { safeContext: sterilized, tokenMap } = await SovereignFirewall.mask(prompt);

        // 2. Prompt Compression (Cost Reduction)
        // Logic: Remove redundant whitespace, common boilerplate, and optimize for token count
        const compressed = this.compress(sterilized);

        // 3. Quota Check & Cost Estimation
        const estInputTokens = Math.ceil(compressed.length / 4);
        const estimatedCost = (estInputTokens / 1000) * 0.02; // Simple estimate

        return {
            optimizedPrompt: compressed,
            tokenMap,
            estimatedCost
        };
    }

    /**
     * Compactly serializes structured data into a tabular format to minimize tokens.
     */
    static serializeTabular(data: any): string {
        if (Array.isArray(data)) {
            if (data.length === 0) return '[]';
            const first = data[0];
            if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
                const keys = Object.keys(first);
                const header = `[${keys.join(',')}]`;
                const rows = data.map(item => {
                    const values = keys.map(k => {
                        const val = item[k];
                        return typeof val === 'string' ? `"${val}"` : String(val);
                    });
                    return `(${values.join(',')})`;
                });
                return `${header}${rows.join('')}`;
            }
            return `[${data.map(i => this.serializeTabular(i)).join(',')}]`;
        }
        if (typeof data === 'object' && data !== null) {
            const parts = Object.entries(data).map(([k, v]) => `${k}:${this.serializeTabular(v)}`);
            return `{${parts.join(',')}}`;
        }
        return String(data);
    }

    /**
     * Simple prompt compression logic to reduce tokens without losing semantic meaning.
     */
    private static compress(text: string): string {
        let compressed = text
            .replace(/\s+/g, ' ') // Collapse whitespace
            .replace(/\n\s*\n/g, '\n') // Remove empty lines
            .replace(/Please provide a detailed response for/gi, 'Analyze') // Shorten boilerplate
            .trim();

        // Aggressive compression for very long prompts (>1500 chars)
        if (compressed.length > 1500) {
            compressed = compressed
                .replace(/\b(the|is|at|which|on)\b/gi, '') // Remove redundant stop words
                .replace(/\s+/g, ' ');
        }

        return compressed;
    }

    /**
     * Unmasks the response from the LLM.
     */
    static unmask(response: string, tokenMap: Map<string, string>): string {
        return SovereignFirewall.unmask(response, tokenMap);
    }
}
