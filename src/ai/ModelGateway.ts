
import { logger } from "@/lib/logger";

/**
 * Frontend Proxy for Model Gateway.
 * 
 * Bypasses local LLM logic and SDKs by forwarding requests to the backend.
 */
export const modelGateway = {
    async generate(request: any): Promise<string> {
        const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || "http://localhost:3001";
        try {
            const response = await fetch(`${apiUrl}/ai/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "askAI", ...request })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(err || `AI Gateway Proxy Error: ${response.status}`);
            }

            const data = await response.json();
            return data.text;
        } catch (error: any) {
            logger.error(`ModelGateway Proxy failed:`, error.message);
            throw error;
        }
    }
};
