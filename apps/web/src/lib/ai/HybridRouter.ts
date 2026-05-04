import { prisma } from "@/lib/db";
import { isEdgeRuntimeOptional } from "@/lib/edgeRuntime";

const ProductMode = {
    ENTERPRISE_CORE: "ENTERPRISE_CORE",
    GROWTH: "GROWTH",
} as const;

type ProductMode = (typeof ProductMode)[keyof typeof ProductMode];

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
    userId?: string; // Bind to individual user edge node
    containsPII?: boolean;
    productMode?: ProductMode;
    requiresResidentialIP?: boolean;
    isComplianceSensitive?: boolean;
}

export class HybridRouter {
    static isEdgeOptionalMode(): boolean {
        return isEdgeRuntimeOptional();
    }

    /**
     * Core routing logic: Determines if task should run on Cloud or On-Prem
     */
    static async route(context: AIContext): Promise<{ destination: AIDestination; model: string; endpoint?: string }> {
        const endpoint = await this.getEndpoint(AIDestination.ON_PREM, context.userId);
        const isEdgeHealthy = await this.checkEdgeNodeHealth(endpoint);
        const edgeOptional = this.isEdgeOptionalMode();
        
        // Rule 1: ENTERPRISE_CORE mode forces on-prem for everything sensitive
        if (context.productMode === ProductMode.ENTERPRISE_CORE && context.isComplianceSensitive) {
            if (!isEdgeHealthy) {
                // If it's compliance sensitive but NO node is bound, we MUST fail closed
                throw new Error("Compliance Violation: Enterprise policy requires a bound Sovereign Node, but none found or node offline.");
            }
            return { destination: AIDestination.ON_PREM, model: "phi-3-mini", endpoint };
        }

        // Rule 2: Any PII must stay on-prem (DPDP Act compliance)
        if (context.containsPII) {
            if (!isEdgeHealthy && !edgeOptional) {
                throw new Error("Sovereign Protection: PII detected but no healthy Edge Node assigned. Blocking cloud egress.");
            }
            if (!isEdgeHealthy) {
                return {
                    destination: AIDestination.CLOUD,
                    model: context.taskType === AITaskType.EMAIL_DRAFT ? "gemini-1.5-pro" : "gemini-1.5-flash"
                };
            }
            return { destination: AIDestination.ON_PREM, model: "phi-3-mini", endpoint };
        }

        // Rule 3: Tasks requiring residential IP
        if (context.requiresResidentialIP) {
            if (!isEdgeHealthy) throw new Error("Infrastructure Missing: Task requires a physical residential node.");
            return { destination: AIDestination.ON_PREM, model: "phi-3-mini", endpoint };
        }

        // Rule 4: Preferred On-Prem, but can fallback to cloud if healthy
        const preferredOnPrem = [
            AITaskType.LINKEDIN_MESSAGE,
            AITaskType.SCRAPING,
            AITaskType.AUTOMATION
        ];

        if (preferredOnPrem.includes(context.taskType)) {
            if (isEdgeHealthy) {
                return { destination: AIDestination.ON_PREM, model: "phi-3-mini", endpoint };
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

    private static async checkEdgeNodeHealth(endpoint: string): Promise<boolean> {
        if (!endpoint || endpoint === "CLOUD") return false;
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
     * Prioritizes User-level binding over Environment-level binding
     */
    static async getEndpoint(destination: AIDestination, userId?: string): Promise<string> {
        if (destination === AIDestination.ON_PREM) {
            // 1. Check for User-specific binding
            if (userId) {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { edgeNodeUri: true }
                });
                if (user?.edgeNodeUri) return user.edgeNodeUri;
            }

            // 2. Fallback to Environment Variables
            return process.env['ON_PREM_AI_ENDPOINT'] || 
                   process.env['EDGE_NODE_URI'] || 
                   process.env['PHI3_LOCAL_ENDPOINT'] ||
                   "http://localhost:8000";
        }

        // Cloud endpoint - returns string to signal standard API usage
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
