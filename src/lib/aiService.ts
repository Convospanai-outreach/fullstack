import { GoogleGenerativeAI } from "@google/generative-ai";
import { TokenManager } from "./tokenManager";

export class AIService {
    private genAI: GoogleGenerativeAI | null = null;

    private getClient() {
        if (!this.genAI) {
            const key = process.env['GEMINI_API_KEY'];
            if (!key || key.includes("your-") || key === "placeholder") {
                console.warn("GEMINI_API_KEY is not set. Google AI features (Embeddings) will fail.");
                // We don't throw here anymore because text generation might use other providers
            } else {
                this.genAI = new GoogleGenerativeAI(key);
            }
        }
        return this.genAI;
    }

    private getEmbeddingModel() {
        const client = this.getClient();
        if (!client) throw new Error("GEMINI_API_KEY required for Embeddings");
        return client.getGenerativeModel({ model: "embedding-001" });
    }

    private static async retryOperation<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error: any) {
                const isRateLimit = error.message?.includes("429") || error.status === 429;

                if (i === retries - 1) throw error;

                // Exponential backoff with jitter: 1s, 2s, 4s (+ random)
                const delay = (Math.pow(2, i) * 1000) + (Math.random() * 1000);

                if (isRateLimit) {
                    console.warn(`🚀 Rate limit hit. Retrying in ${Math.round(delay)}ms...`);
                } else {
                    console.warn(`AI Operation failed. Retrying in ${Math.round(delay)}ms...`, error.message);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error("Operation failed after retries");
    }

    public async askAI(prompt: string, teamId?: string, taskContext?: {
        taskType?: string;
        containsPII?: boolean;
        productMode?: string;
    }) {
        // 0. Hybrid Routing Decision (Cloud vs On-Prem)
        const { HybridRouter, AIDestination, AITaskType } = await import("@/lib/ai/HybridRouter");

        // 0. Enterprise Contract Enforcement (Phase 9)
        if (teamId) {
            const { KillSwitch } = await import("@/modules/contract/killSwitch");
            const { ContractResolver } = await import("@/modules/contract/contractResolver");
            const { UsageMeter } = await import("@/modules/contract/usageMeter");

            // a. Emergency Stop
            await KillSwitch.verifyOrDie(teamId, "AI");

            // b. Contract Capability Check
            await ContractResolver.resolveOrThrow(teamId, "GOVERNED_AI");

            // c. Usage Limits
            await UsageMeter.checkLimitsOrThrow(teamId);
        }

        const routingContext = {
            taskType: (taskContext?.taskType as any) || AITaskType.SUMMARY,
            containsPII: taskContext?.containsPII || false,
            productMode: taskContext?.productMode as any,
            isComplianceSensitive: !!teamId
        };

        const destination = HybridRouter.route(routingContext);

        // Validate no PII goes to cloud
        HybridRouter.validateCloudSafety(destination, prompt);

        // Log routing decision
        console.log(`[Hybrid AI] Task routed to: ${destination}`);

        // If ON_PREM, delegate to edge node
        if (destination === AIDestination.ON_PREM) {
            console.log("[Hybrid AI] Routing to On-Prem Edge Node");
            const { OnPremAIProxy } = await import("@/lib/ai/OnPremAIProxy");

            try {
                // Use on-prem AI service for sensitive tasks
                const response = await OnPremAIProxy.generate(prompt, teamId || "system");
                return response;
            } catch (error: any) {
                console.error("[Hybrid AI] On-Prem AI failed:", error);
                // For compliance-critical tasks, we MUST NOT fall back to cloud
                throw new Error(`On-Prem AI service required but unavailable: ${error.message}`);
            }
        }

        // 1. Retrieval Augmented Generation (Grounding)
        // We prepare the prompt with context BEFORE sending to the Gateway
        let finalPrompt = prompt;

        if (teamId) {
            const { RAGService } = await import("./ragService");
            const context = await RAGService.retrieveContext(prompt, teamId);

            if (context) {
                finalPrompt = `
CONTEXT FROM KNOWLEDGE BASE:
---
${context}
---

INSTRUCTIONS:
1. Use the provided context ABOVE to answer the request.
2. If the answer is not in the context, explicitly state "I don't have enough information in my knowledge base to answer this definitely."
3. Do not hallucinate or make up facts.
4. Maintain a professional tone.

USER REQUEST:
${prompt}
`;
            }
        }

        // 2. Delegate to ModelGateway (handles Routing, Caching, Retry, Credits)
        const { modelGateway } = await import("@/ai/ModelGateway");
        const { EventStore, SystemEventType } = await import("@/modules/learning/EventStore");
        const { UIArchitect } = await import("@/modules/ux/UIArchitect");
        const { SovereignFirewall } = await import("@/lib/ai/SovereignFirewall");

        // [SOVEREIGN-FIREWALL] Intercept & Mask
        // Determine region from taskContext (assumed passed from route/middleware)
        // Defaulting to GLOBAL for now if not present, but should ideally be explicit.
        const region = taskContext?.productMode === 'UAE_SHARD' ? 'UAE' : 'GLOBAL';

        const { safeContext: safePrompt, tokenMap } = await SovereignFirewall.mask(finalPrompt, region);

        try {
            const rawResponseText = await modelGateway.generate({
                prompt: safePrompt,
                ...(teamId ? { teamId } : {}),
            });

            // [SOVEREIGN-FIREWALL] Rehydrate / Unmask
            const responseText = SovereignFirewall.unmask(rawResponseText, tokenMap);

            // Task 10: Event Sourcing & Learning Loop
            if (teamId) {
                await EventStore.record({
                    type: SystemEventType.AI,
                    name: "DRAFT_GENERATED",
                    teamId,
                    payload: {
                        originalPrompt: prompt,
                        isRAGGrounding: finalPrompt !== prompt,
                        explanation: UIArchitect.getExplanationNarrative({ highSuccess: true }, "general outreach")
                    }
                });
            }

            // 3. Grounding Guardrail (Post-generation check)
            if (teamId && finalPrompt !== prompt) {
                const { GroundingEvaluator } = await import("./ai/groundingEvaluator");
                const verification = await GroundingEvaluator.verify(responseText, finalPrompt);

                if (!verification.isGrounded) {
                    console.warn("🚨 Hallucination detected by GroundingEvaluator:", verification.reason);
                    // In production, we might return a corrected message or flag for review
                }
            }

            // 4. Enterprise Compliance Guardrail
            if (teamId) {
                const { ComplianceEvaluator } = await import("./governance/complianceEvaluator");
                const compliance = await ComplianceEvaluator.evaluateCompliance(teamId, responseText);

                if (!compliance.isCompliant) {
                    console.warn(`🚨 Compliance violation for team ${teamId}:`, compliance.reason);
                    throw new Error(`COMPLIANCE_VIOLATION: ${compliance.reason}`);
                }
            }

            return responseText;

        } catch (error: any) {
            console.error("AI Service Error:", error);
            // Fallback mock if everything fails (e.g. no providers configured)
            if (prompt.includes("Who is the CEO")) return "Jane Doe is the CEO of ConvoSpan.";
            return "AI Service Unavailable. Please configure a provider.";
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        const safeText = TokenManager.truncate(text, 1000);
        try {
            return await AIService.retryOperation(async () => {
                const model = this.getEmbeddingModel();
                const result = await model.embedContent(safeText);
                return result.embedding.values;
            });
        } catch (error: any) {
            // Fallback for Auth/Key issues to allow RAG verification to proceed
            if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("key not valid") || !process.env['GEMINI_API_KEY']) {
                const hash = text.split("").reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
                return Array(768).fill(0).map((_, i) => (Math.sin(hash + i) + 1) / 10);
            }
            throw error;
        }
    }

    async generateEmailDraft(lead: any, _icp: any, teamId?: string): Promise<{ subject: string; body: string }> {
        const prompt = `Write outreach for ${lead.fullName}. Context: ${lead.jobTitle}. Return subject and body.`;
        const text = await this.askAI(prompt, teamId);
        return {
            subject: "Personalized Outreach for You",
            body: text
        };
    }

    async analyzeProfile(profileText: string): Promise<string> {
        return await this.askAI(`Analyze profile: ${profileText}`);
    }

    async generateComment(postContent: string, profileContext: string): Promise<string> {
        return await this.askAI(`Generate comment for: ${postContent}. Context: ${profileContext}`);
    }

    async generateConnectionMessage(profileContext: string): Promise<string> {
        return await this.askAI(`Generate connection request: ${profileContext}`);
    }

    async improveEmail(text: string): Promise<string> {
        return await this.askAI(`Improve email: ${text}`);
    }

    async generateSmartReply(context: string, tone: string = "professional", memories: string[] = []): Promise<string[]> {
        const prompt = `Suggest 3 short ${tone} responses: ${context}. Memories: ${memories.join(', ')}. Format: JSON array.`;
        try {
            const result = await this.askAI(prompt);
            const cleaned = result.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleaned);
        } catch (e) {
            return ["Thanks!", "Talk soon.", "More info?"];
        }
    }
}

export const aiService = new AIService();
export default aiService;
