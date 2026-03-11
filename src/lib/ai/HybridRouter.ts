import { ProductMode } from "@prisma/client";

export enum AIDestination {
    CLOUD = "CLOUD",
    ON_PREM = "ON_PREM"
}

export enum AITaskType {
    EMAIL_DRAFT = "EMAIL_DRAFT",
    LINKEDIN_MESSAGE = "LINKEDIN_MESSAGE",
    LEAD_ENRICHMENT = "LEAD_ENRICHMENT",
    RAG_QUERY = "RAG_QUERY",
    SUMMARY = "SUMMARY",
    SCRAPING = "SCRAPING",
    AUTOMATION = "AUTOMATION"
}

export interface AIContext {
    taskType: AITaskType;
    containsPII?: boolean;
    productMode?: ProductMode;
    requiresResidentialIP?: boolean;
    isComplianceSensitive?: boolean;
}

export class HybridRouter {

    /**
     * Core routing logic: Determines if task should run on Cloud or On-Prem
     */
    static async route(context: AIContext): Promise<{ destination: AIDestination; model: string }> {
        const isEdgeHealthy = await this.checkEdgeNodeHealth();
        
        // Rule 1: ENTERPRISE_CORE mode forces on-prem for everything sensitive
        if (context.productMode === ProductMode.ENTERPRISE_CORE && context.isComplianceSensitive) {
            if (!isEdgeHealthy) throw new Error("Sovereign Node Offline: Cannot process compliance-sensitive task.");
            return { destination: AIDestination.ON_PREM, model: "phi-3-mini" };
        }

        // Rule 2: Any PII must stay on-prem (DPDP Act compliance)
        if (context.containsPII) {
            if (!isEdgeHealthy) throw new Error("Sovereign Node Offline: PII detected, blocking cloud egress.");
            return { destination: AIDestination.ON_PREM, model: "phi-3-mini" };
        }

        // Rule 3: Tasks requiring residential IP
        if (context.requiresResidentialIP) {
            if (!isEdgeHealthy) throw new Error("Sovereign Node Offline: Physical node required for automation.");
            return { destination: AIDestination.ON_PREM, model: "phi-3-mini" };
        }

        // Rule 4: Preferred On-Prem, but can fallback to cloud if healthy
        const preferredOnPrem = [
            AITaskType.LINKEDIN_MESSAGE,
            AITaskType.SCRAPING,
            AITaskType.AUTOMATION
        ];

        if (preferredOnPrem.includes(context.taskType)) {
            if (isEdgeHealthy) {
                return { destination: AIDestination.ON_PREM, model: "phi-3-mini" };
            }
            // Fallback to Cloud ONLY if non-PII and not strictly residential
            return { destination: AIDestination.CLOUD, model: "gemini-1.5-flash" };
        }

        // Default: Pure intelligence tasks go to cloud
        return { 
            destination: AIDestination.CLOUD, 
            model: context.taskType === AITaskType.EMAIL_DRAFT ? "gemini-1.5-pro" : "gemini-1.5-flash"
        };
    }

    private static async checkEdgeNodeHealth(): Promise<boolean> {
        const endpoint = this.getEndpoint(AIDestination.ON_PREM);
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 1000); // 1s timeout
            const res = await fetch(`${endpoint}/health`, { signal: controller.signal });
            clearTimeout(id);
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    /**
     * Helper to get the appropriate endpoint based on destination
     */
    static getEndpoint(destination: AIDestination): string {
        if (destination === AIDestination.ON_PREM) {
            return process.env['ON_PREM_AI_ENDPOINT'] || process.env['EDGE_NODE_URI'] || "http://localhost:8000";
        }

        // Cloud endpoint - returns null to signal standard API usage
        return "CLOUD";
    }

    /**
     * Validate that no PII is being sent to cloud
     */
    static validateCloudSafety(destination: AIDestination, prompt: string): void {
        if (destination === AIDestination.CLOUD) {
            // Basic PII detection patterns
            const piiPatterns = [
                /\b\d{3}-\d{2}-\d{4}\b/, // SSN
                /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
                /\b\d{10}\b/, // Phone (basic)
                /\b(?:\d{4}[-\s]?){3}\d{4}\b/ // Credit card
            ];

            for (const pattern of piiPatterns) {
                if (pattern.test(prompt)) {
                    throw new Error("PII detected in cloud-bound request. Routing violation.");
                }
            }
        }
    }
}
