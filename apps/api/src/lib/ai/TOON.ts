import { SovereignFirewall } from './SovereignFirewall';
import { runTOONCore, serializeTabularData } from './toonCore';

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
    static async process(prompt: string, _teamId: string): Promise<TOONResult> {
        // 1. Data Sterilization (PII Masking)
        const { safeContext: sterilized, tokenMap } = await SovereignFirewall.mask(prompt);

        const { optimizedPrompt, estimatedCost } = runTOONCore(sterilized);

        return {
            optimizedPrompt,
            tokenMap,
            estimatedCost
        };
    }

    /**
     * Compactly serializes structured data into a tabular format to minimize tokens.
     */
    static serializeTabular(data: any): string {
        return serializeTabularData(data);
    }

    /**
     * Unmasks the response from the LLM.
     */
    static unmask(response: string, tokenMap: Map<string, string>): string {
        return SovereignFirewall.unmask(response, tokenMap);
    }
}
