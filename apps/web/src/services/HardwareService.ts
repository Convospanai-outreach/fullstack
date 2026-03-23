import { logger } from "@/lib/logger";

const EDGE_NODE_URI = process.env['EDGE_NODE_URL'] || process.env['EDGE_NODE_URI'] || 'http://localhost:8000';

export interface SanitizeResponse {
    sanitized_text: string;
    token_map_id: string;
    metadata_tags?: Record<string, string>; // New: Semantic-Aware Tokenization
    stats: Record<string, number>;
}

export interface CritiqueResponse {
    status: 'APPROVED' | 'REJECTED';
    similarity_score: number;
    reason?: string;
}

export interface SearchResult {
    content: string;
    score: number;
    metadata?: Record<string, any>;
}

export interface Workflow {
    id?: string;
    name: string;
    steps: any[];
    teamId: string;
}

export interface IdentityResponse {
    email?: string;
    name?: string;
    phone?: string;
    [key: string]: any;
}

export class HardwareService {
    /**
     * Verifies that the physical hardware is present and matches the signature.
     * Throws an error if verification fails.
     */
    static async verifyHardwareIdentity(): Promise<void> {
        try {
            // detailed connection log removed for security

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const response = await fetch(`${EDGE_NODE_URI}/health`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                 throw new Error(`Edge Node HTTP error: ${response.status}`);
            }
            
            const data = await response.json();
            const { status, hardware_id } = data;

            if (status !== 'ONLINE') {
                throw new Error(`Edge Node reported status: ${status}`);
            }

            // signature log removed for security

            if (!hardware_id) {
                throw new Error('No hardware signature received from Edge Node.');
            }

            // Strict Attestation: Check against env var
            const expectedSig = process.env['HARDWARE_SIGNATURE'];
            if (expectedSig && hardware_id !== expectedSig) {
                logger.error(`[HardwareService] CRITICAL: Signature Mismatch! Expected ${expectedSig}, got ${hardware_id}`);
                throw new Error("Hardware Attestation Failed: Signature Mismatch. Potential Rogue Edge Node.");
            }

            logger.info('[HardwareService] Hardware Identity Verified.');
        } catch (error: any) {
            logger.error('[HardwareService] CRITICAL: Hardware verification failed.', error);
            throw new Error(`Hardware Verification Failed: ${error.message}. Ensure the PHYSICAL DEVICE is connected.`);
        }
    }

    static async sanitize(text: string): Promise<SanitizeResponse> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${EDGE_NODE_URI}/sanitize`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return await response.json();
        } catch (error: any) {
            throw new Error(`Edge Sanitization Failed: ${error.message}`);
        }
    }

    static async critique(text: string, context?: string): Promise<CritiqueResponse> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${EDGE_NODE_URI}/critique`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, context }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return await response.json();
        } catch (error: any) {
            // "Failsafe - if Edge is offline, Agent MUST fail."
            throw new Error(`Edge Critique Failed: ${error.message}`);
        }
    }

    static async search(query: string): Promise<SearchResult[]> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${EDGE_NODE_URI}/search`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, limit: 3 }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            return data.results;
        } catch (error: any) {
            logger.error("Hardware Search Error:", error);
            // Fallback to empty array to not break UI, but log error
            return [];
        }
    }

    static async execute(action: string, payload: Record<string, any>): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${EDGE_NODE_URI}/execute`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return true;
        } catch (error: any) {
            logger.error("Hardware Execution Error:", error);
            throw new Error("Physical Actuator Unreachable");
        }
    }

    // --- NIDHI-PRAYAS ADDITIONS ---

    static async saveWorkflow(workflow: Workflow): Promise<void> {
        try {
            logger.info("[HardwareService] Saving Workflow to Sovereign Edge Storage...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${EDGE_NODE_URI}/workflows/save`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflow }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        } catch (error: any) {
            logger.error("Failed to save workflow to Edge Node", error);
            // Non-blocking in dev but critical in prod
            throw error;
        }
    }

    static async getWorkflows(): Promise<Workflow[]> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${EDGE_NODE_URI}/workflows`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            return await res.json();
        } catch (error) {
            return [];
        }
    }

    static async setComplianceMode(region: 'INDIA' | 'EU'): Promise<void> {
        try {
            logger.info(`[HardwareService] Enforcing Region Compliance: ${region}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${EDGE_NODE_URI}/compliance/mode`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ region }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        } catch (error) {
            logger.error("Failed to set compliance mode on Edge Node");
        }
    }

    static async reIdentify(maskedId: string, purpose: string): Promise<IdentityResponse> {
        try {
            logger.info(`[HardwareService] Re-identifying ${maskedId} for purpose: ${purpose}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${EDGE_NODE_URI}/identity/resolve`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maskedId, purpose }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return await response.json();
        } catch (error: any) {
            logger.error(`[HardwareService] Re-identification failed: ${error.message}`);
            throw new Error(`Identity Resolution Failed: ${error.message}. Secure enclave unreachable.`);
        }
    }
}

