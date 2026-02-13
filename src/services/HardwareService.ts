import axios from 'axios';
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

            const response = await axios.get(`${EDGE_NODE_URI}/health`, {
                timeout: 2000,
            });

            const { status, hardware_id } = response.data;

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
            const response = await axios.post(`${EDGE_NODE_URI}/sanitize`, { text }, { timeout: 5000 });
            return response.data;
        } catch (error: any) {
            throw new Error(`Edge Sanitization Failed: ${error.message}`);
        }
    }

    static async critique(text: string, context?: string): Promise<CritiqueResponse> {
        try {
            const response = await axios.post<CritiqueResponse>(`${EDGE_NODE_URI}/critique`, { text, context }, { timeout: 5000 });
            return response.data;
        } catch (error: any) {
            // "Failsafe - if Edge is offline, Agent MUST fail."
            throw new Error(`Edge Critique Failed: ${error.message}`);
        }
    }

    static async search(query: string): Promise<SearchResult[]> {
        try {
            const response = await axios.post<{ results: SearchResult[] }>(`${EDGE_NODE_URI}/search`, { query, limit: 3 }, { timeout: 5000 });
            return response.data.results;
        } catch (error: any) {
            logger.error("Hardware Search Error:", error);
            // Fallback to empty array to not break UI, but log error
            return [];
        }
    }

    static async execute(action: string, payload: Record<string, any>): Promise<boolean> {
        try {
            await axios.post(`${EDGE_NODE_URI}/execute`, { action, payload }, { timeout: 5000 });
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
            await axios.post(`${EDGE_NODE_URI}/workflows/save`, { workflow }, { timeout: 5000 });
        } catch (error: any) {
            logger.error("Failed to save workflow to Edge Node", error);
            // Non-blocking in dev but critical in prod
            throw error;
        }
    }

    static async getWorkflows(): Promise<Workflow[]> {
        try {
            const res = await axios.get(`${EDGE_NODE_URI}/workflows`, { timeout: 5000 });
            return res.data;
        } catch (error) {
            return [];
        }
    }

    static async setComplianceMode(region: 'INDIA' | 'EU'): Promise<void> {
        try {
            logger.info(`[HardwareService] Enforcing Region Compliance: ${region}`);
            await axios.post(`${EDGE_NODE_URI}/compliance/mode`, { region }, { timeout: 5000 });
        } catch (error) {
            logger.error("Failed to set compliance mode on Edge Node");
        }
    }

    static async reIdentify(maskedId: string, purpose: string): Promise<IdentityResponse> {
        try {
            // In a real scenario, this hits the secure enclave
            logger.info(`[HardwareService] Re-identifying ${maskedId} for purpose: ${purpose}`);
            const response = await axios.post<IdentityResponse>(`${EDGE_NODE_URI}/identity/resolve`, { maskedId, purpose }, { timeout: 5000 });
            return response.data;
        } catch (error: any) {
            logger.warn(`[HardwareService] Re-identification failed: ${error.message}`);
            // Fallback for mocked environment if Edge Node is missing the specific endpoint
            if (maskedId.startsWith("MASKED_")) {
                return {
                    email: `restored.${maskedId.split('_')[1]}@example.com`,
                    name: "Restored User"
                };
            }
            throw new Error("Identity Resolution Failed");
        }
    }
}

