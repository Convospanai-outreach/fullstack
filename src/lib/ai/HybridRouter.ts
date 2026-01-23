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
    static route(context: AIContext): AIDestination {

        // Rule 1: ENTERPRISE_CORE mode forces on-prem for everything sensitive
        if (context.productMode === ProductMode.ENTERPRISE_CORE && context.isComplianceSensitive) {
            return AIDestination.ON_PREM;
        }

        // Rule 2: Any PII must stay on-prem (DPDP Act compliance)
        if (context.containsPII) {
            return AIDestination.ON_PREM;
        }

        // Rule 3: Tasks requiring residential IP (LinkedIn automation, scraping)
        if (context.requiresResidentialIP) {
            return AIDestination.ON_PREM;
        }

        // Rule 4: Specific task types that are inherently risky
        const onPremTasks = [
            AITaskType.LINKEDIN_MESSAGE,
            AITaskType.SCRAPING,
            AITaskType.AUTOMATION
        ];

        if (onPremTasks.includes(context.taskType)) {
            return AIDestination.ON_PREM;
        }

        // Rule 5: Lead enrichment with PII
        if (context.taskType === AITaskType.LEAD_ENRICHMENT && context.containsPII) {
            return AIDestination.ON_PREM;
        }

        // Default: Safe tasks go to cloud (cheaper, faster)
        return AIDestination.CLOUD;
    }

    /**
     * Helper to get the appropriate endpoint based on destination
     */
    static getEndpoint(destination: AIDestination): string {
        if (destination === AIDestination.ON_PREM) {
            return process.env.ON_PREM_AI_ENDPOINT || process.env.EDGE_NODE_URI || "http://localhost:8000";
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
