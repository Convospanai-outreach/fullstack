import { ModelRequest } from "@/ai/types";
import { aiService } from "@/lib/aiService";

export class ContextBundler {
    private readonly MAX_TOKENS_DEFAULT = 2000;

    /**
     * Bundles multiple messages into a single context string to save tokens.
     * Truncates older messages if the limit is reached.
     */
    bundle(messages: string[], maxTokens: number = this.MAX_TOKENS_DEFAULT): string {
        // Simplified loose token estimation (4 chars ~= 1 token)
        let tokenCount = 0;
        const bundled: string[] = [];

        // Add from newest to oldest
        const reversed = [...messages].reverse();
        for (const msg of reversed) {
            if (!msg) continue;
            const estTokens = msg.length / 4;

            if (tokenCount + estTokens > maxTokens) {
                break;
            }

            bundled.unshift(msg);
            tokenCount += estTokens;
        }

        return bundled.join("\n\n---\n\n");
    }

    /**
     * Optimizes a ModelRequest by summarizing history if it's too long.
     */
    async optimizeContext(request: ModelRequest): Promise<ModelRequest> {
        // 1. Check if context is a large array
        if (Array.isArray(request.context) && request.context.length > 5) {
            
            // Try LLM-based intelligent summarization first
            try {
                const combined = request.context.map((c: any) => JSON.stringify(c)).join("\n");
                // Loose token check
                if (combined.length > 4000) { 
                    const prompt = `Please summarize the following conversation context into a dense, highly factual summary. Preserve all names, dates, key decisions, and constraints. Omit pleasantries.\n\nCONTEXT:\n${combined}`;
                    // We use aiService with a systemic "system" teamId or bypass if internal
                    const summary = await aiService.askAI(prompt, "system-optimization", { groundingContext: combined });
                    
                    return {
                        ...request,
                        context: `[AUTOMATED CONTEXT SUMMARY]\n${summary}`
                    };
                }
            } catch (error) {
                console.warn("[ContextBundler] AI Summarization failed, falling back to truncation.", error);
            }

            // Fallback to basic truncation bundler
            const optimizedContext = this.bundle(request.context.map((c: any) => JSON.stringify(c)));
            return {
                ...request,
                context: optimizedContext
            };
        }

        return request;
    }
}

export const contextBundler = new ContextBundler();
