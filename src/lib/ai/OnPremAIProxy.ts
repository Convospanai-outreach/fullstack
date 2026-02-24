/**
 * On-Prem AI Proxy
 * 
 * This service proxies AI requests to the on-premises Edge Node.
 * The Edge Node (running at EDGE_NODE_URI or ON_PREM_AI_ENDPOINT) 
 * handles sensitive AI workloads that cannot be sent to cloud providers.
 * 
 * Use cases:
 * - LinkedIn automation (requires residential IP)
 * - PII-containing requests (DPDP Act compliance)
 * - Lead enrichment with sensitive data
 * - Scraping and automation tasks
 */

export class OnPremAIProxy {

    private static getEndpoint(): string {
        return process.env['ON_PREM_AI_ENDPOINT'] || process.env['EDGE_NODE_URI'] || "http://localhost:8000";
    }

    /**
     * Sends a request to the on-prem AI service
     * 
     * NOTE: This is a stub. The actual Edge Node AI service needs to be implemented
     * in the services/edge-node directory with AI model hosting capabilities.
     */
    static async generate(prompt: string, teamId: string, options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<string> {

        const endpoint = this.getEndpoint();

        try {
            const response = await fetch(`${endpoint}/ai/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Hardware signature for authentication
                    "X-Hardware-Signature": process.env['HARDWARE_SIGNATURE'] || ""
                },
                body: JSON.stringify({
                    prompt,
                    model: options?.model || "llama-3.1-8b", // Default to local model
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 1000
                })
            });

            if (!response.ok) {
                throw new Error(`Edge Node AI failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const resultText = data.text || data.response || "";

            // AUDIT TRAIL (Compliance Requirement)
            // Even local invocations must be logged to prove "Human-in-the-loop" or "System Action"
            const { EventStore, SystemEventType } = await import("@/modules/learning/EventStore");
            await EventStore.record({
                type: SystemEventType.AI,
                name: "ON_PREM_GENERATION",
                teamId: teamId || "system", 
                payload: {
                    promptLength: prompt.length,
                    model: options?.model || "llama-local",
                    endpoint,
                    success: true
                }
            });

            return resultText;

        } catch (error: any) {
            console.error("[OnPremAIProxy] Error:", error);

            // LOG FAILURE
            try {
                const { EventStore, SystemEventType } = await import("@/modules/learning/EventStore");
                await EventStore.record({
                    type: SystemEventType.SYSTEM,
                    name: "ON_PREM_FAILURE",
                    teamId: "system",
                    payload: { error: error.message, endpoint }
                });
            } catch (e) { /* Ignore log failure to prevent infinite loop */ }

            // Fallback: If edge node is unavailable, we CANNOT proceed with PII tasks
            // This is a critical failure for compliance
            throw new Error(
                `On-Prem AI service unavailable. Cannot process sensitive request. ` +
                `Endpoint: ${endpoint}. Error: ${error.message}`
            );
        }
    }

    /**
     * Health check for the on-prem service
     */
    static async healthCheck(): Promise<boolean> {
        try {
            const endpoint = this.getEndpoint();
            const response = await fetch(`${endpoint}/health`, {
                method: "GET",
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            return response.ok;
        } catch (error) {
            console.warn("[OnPremAIProxy] Health check failed:", error);
            return false;
        }
    }
}
