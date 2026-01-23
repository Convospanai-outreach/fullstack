import axios from 'axios';

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
    metadata?: any;
}

export class HardwareService {
    /**
     * Verifies that the physical hardware is present and matches the signature.
     * Throws an error if verification fails.
     */
    static async verifyHardwareIdentity(): Promise<void> {
        try {
            console.log(`[HardwareService] Connecting to Edge Node at ${EDGE_NODE_URI}...`);

            const response = await axios.get(`${EDGE_NODE_URI}/health`, {
                timeout: 2000,
            });

            const { status, hardware_id } = response.data;

            if (status !== 'ONLINE') {
                throw new Error(`Edge Node reported status: ${status}`);
            }

            console.log(`[HardwareService] Edge Node Signature: ${hardware_id}`);

            if (!hardware_id) {
                throw new Error('No hardware signature received from Edge Node.');
            }

            // Optional: Check against env var if crucial
            const expectedSig = process.env['HARDWARE_SIGNATURE'];
            if (expectedSig && hardware_id !== expectedSig) {
                console.warn(`[HardwareService] WARNING: Signature Mismatch! Expected ${expectedSig}, got ${hardware_id}`);
            }

            console.log('[HardwareService] Hardware Identity Verified.');
        } catch (error: any) {
            console.error('[HardwareService] CRITICAL: Hardware verification failed.');
            console.error(error.message);
            throw new Error(`Hardware Verification Failed: ${error.message}. Ensure the PHYSICAL DEVICE is connected.`);
        }
    }

    static async sanitize(text: string): Promise<SanitizeResponse> {
        try {
            const response = await axios.post(`${EDGE_NODE_URI}/sanitize`, { text });
            return response.data;
        } catch (error: any) {
            throw new Error(`Edge Sanitization Failed: ${error.message}`);
        }
    }

    static async critique(text: string, context?: string): Promise<CritiqueResponse> {
        try {
            const response = await axios.post<CritiqueResponse>(`${EDGE_NODE_URI}/critique`, { text, context });
            return response.data;
        } catch (error: any) {
            // "Failsafe - if Edge is offline, Agent MUST fail."
            throw new Error(`Edge Critique Failed: ${error.message}`);
        }
    }

    static async search(query: string): Promise<SearchResult[]> {
        try {
            const response = await axios.post<{ results: SearchResult[] }>(`${EDGE_NODE_URI}/search`, { query, limit: 3 });
            return response.data.results;
        } catch (error: any) {
            console.error("Hardware Search Error:", error);
            // Fallback to empty array to not break UI, but log error
            return [];
        }
    }

    static async execute(action: string, payload: any): Promise<boolean> {
        try {
            await axios.post(`${EDGE_NODE_URI}/execute`, { action, payload });
            return true;
        } catch (error: any) {
            console.error("Hardware Execution Error:", error);
            throw new Error("Physical Actuator Unreachable");
        }
    }

    // --- NIDHI-PRAYAS ADDITIONS ---

    static async saveWorkflow(workflow: any): Promise<void> {
        try {
            console.log("[HardwareService] Saving Workflow to Sovereign Edge Storage...");
            await axios.post(`${EDGE_NODE_URI}/workflows/save`, { workflow });
        } catch (error: any) {
            console.error("Failed to save workflow to Edge Node", error);
            // Non-blocking in dev but critical in prod
            throw error;
        }
    }

    static async getWorkflows(): Promise<any[]> {
        try {
            const res = await axios.get(`${EDGE_NODE_URI}/workflows`);
            return res.data;
        } catch (error) {
            return [];
        }
    }

    static async setComplianceMode(region: 'INDIA' | 'EU'): Promise<void> {
        try {
            console.log(`[HardwareService] Enforcing Region Compliance: ${region}`);
            await axios.post(`${EDGE_NODE_URI}/compliance/mode`, { region });
        } catch (error) {
            console.error("Failed to set compliance mode on Edge Node");
        }
    }
}

