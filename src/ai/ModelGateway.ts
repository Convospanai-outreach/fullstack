
import { z } from "zod";

export enum TaskComplexity {
    ROUTINE = "ROUTINE",    // Extraction, Classification, Simple Drafting
    STRATEGIC = "STRATEGIC" // Creative Drafting, Complex Reasoning, Strategy
}

export interface ModelRequest {
    prompt: string;
    complexity?: TaskComplexity;
    context?: any;
}

export class ModelGateway {

    /**
     * Intelligently routes the request to the most cost-effective model
     */
    async generate(request: ModelRequest): Promise<string> {
        const complexity = request.complexity || this.analyzeComplexity(request.prompt);

        if (complexity === TaskComplexity.STRATEGIC) {
            return this.callFrontierModel(request.prompt);
        } else {
            return this.callHostedSLM(request.prompt);
        }
    }

    /**
     * Heuristic to determine complexity if not provided
     */
    private analyzeComplexity(prompt: string): TaskComplexity {
        const p = prompt.toLowerCase();
        // Simple keywords for now. In production, use a classifier 
        // or routing model (like RouteLLM).
        if (p.includes("strategy") || p.includes("creative") || p.includes("plan") || p.length > 1000) {
            return TaskComplexity.STRATEGIC;
        }
        return TaskComplexity.ROUTINE;
    }

    private async callFrontierModel(prompt: string): Promise<string> {
        // Adapter for OpenAI / Claude 3.5 Sonnet
        // Using process.env.OPENAI_API_KEY
        console.log("[Gateway] Routing to Frontier Model (Cost: High)");
        // Stub implementation
        return "This is a strategic response from GPT-4o.";
    }

    private async callHostedSLM(prompt: string): Promise<string> {
        // Adapter for local/hosted Llama-3-8b / Phi-3
        // Could also be a very cheap provider like Groq
        console.log("[Gateway] Routing to SLM (Cost: Low)");
        return "This is a routine response from Llama-3.";
    }
}

export const modelGateway = new ModelGateway();
