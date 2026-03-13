
import { MicroLLMRequest, MicroLLMResponse } from "./MicroLLMTypes";

/**
 * MicroLLMClient - "Stage 0" Directive Implementation
 * 
 * connecting to Local Inference Runtime (e.g. llama.cpp)
 * Address: process.env['MICRO_LLM_URL'] || "http://localhost:8081"
 * 
 * NON-NEGOTIABLE CONSTRAINTS:
 * - No Retries (Fail Fast)
 * - Strict Timeout (< 1000ms target, max 2000ms allowed)
 * - No Streaming
 * - No History/Memory
 */
export class MicroLLMClient {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;

    constructor(baseUrl?: string, timeoutMs: number = 1000) {
        this.baseUrl = baseUrl || process.env['MICRO_LLM_URL'] || "http://localhost:8081";
        this.timeoutMs = timeoutMs;
    }

    /**
     * Invokes the local Micro-LLM with strict constraints.
     * - No retries
     * - Timeout: 1000ms (Raspberry Pi deployment)
     * - Stateless (no memory)
     * @param request Typed request payload
     * @param context Optional retrieved cultural/safety context
     */
    async infer(request: MicroLLMRequest, context?: string): Promise<MicroLLMResponse> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeoutMs);
        const startTime = Date.now();

        try {
            console.log(`[MicroLLM] Request: ${request.taskType} -> ${this.baseUrl}/infer`);

            // Inject context if present (RAG-Enriched Prompt)
            let finalInput = request.inputText;
            if (context) {
                // Prepending context in a clearly demarcated way
                // This informs the model without overriding the core instruction
                finalInput = `[CONTEXT: ${context}] ${request.inputText}`;
            }

            const response = await fetch(`${this.baseUrl}/infer`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Micro-Task": request.taskType // For audit/routing
                },
                body: JSON.stringify({
                    ...request,
                    inputText: finalInput
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                // FAIL FAST: No retries for 500s
                throw new Error(`Micro-LLM Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const latency = Date.now() - startTime;

            // Validate Response Shape (Runtime Check)
            if (typeof data.confidence !== 'number') {
                throw new Error("Micro-LLM Protocol Violation: Missing confidence score");
            }

            return {
                ...data,
                latencyMs: latency
            };

        } catch (error: any) {
            clearTimeout(id);
            const latency = Date.now() - startTime;

            if (error.name === 'AbortError') {
                console.error(`[MicroLLM] Timeout after ${this.timeoutMs}ms (Latency: ${latency}ms)`);
                throw new Error(`Micro-LLM Timeout (${this.timeoutMs}ms)`);
            }

            console.error(`[MicroLLM] Inference Failed (${latency}ms):`, error.message);
            throw error; // Propagate up, do not retry
        }
    }
}

export const microLLM = new MicroLLMClient();
