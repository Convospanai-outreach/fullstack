import { logger } from "@/lib/logger";

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001/api';

export interface SanitizeResponse {
    sanitized_text: string;
    token_map_id: string;
    metadata_tags?: Record<string, string>;
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

export interface EdgeNodeStatus {
    connected: boolean;
    hardwareId?: string;
    signatureMatch?: boolean;
    latencyMs?: number;
    error?: string;
}

export interface ActivityEntry {
    id: string;
    function: string;
    entityTypes: string[] | null;
    entityCount: number;
    sessionId: string | null;
    createdAt: string;
}

export class HardwareService {
    private static async callAPI(action: string, payload: any) {
        const response = await fetch(`${API_BASE}/hardware`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `API Error: ${response.status}`);
        }
        return response.json();
    }

    static async verifyHardwareIdentity(): Promise<void> {
        await this.callAPI("VERIFY", {});
    }

    static async sanitize(text: string): Promise<SanitizeResponse> {
        return await this.callAPI("SANITIZE", { text });
    }

    static async critique(text: string, context?: string): Promise<CritiqueResponse> {
        return await this.callAPI("CRITIQUE", { text, context });
    }

    static async search(query: string): Promise<SearchResult[]> {
        const data = await this.callAPI("SEARCH", { query });
        return data.results;
    }

    static async execute(action: string, payload: Record<string, any>): Promise<boolean> {
        const data = await this.callAPI("EXECUTE", { payload: { actuator: action, ...payload } });
        return data.success;
    }

    static async saveWorkflow(workflow: Workflow): Promise<void> {
        await this.callAPI("SAVE_WORKFLOW", { workflow });
    }

    static async getWorkflows(): Promise<Workflow[]> {
        const res = await fetch(`${API_BASE}/hardware`);
        if (!res.ok) return [];
        return await res.json();
    }

    static async setComplianceMode(region: 'INDIA' | 'EU'): Promise<void> {
        await this.callAPI("SET_COMPLIANCE", { region });
    }

    static async reIdentify(maskedId: string, purpose: string): Promise<IdentityResponse> {
        return await this.callAPI("RE_IDENTIFY", { maskedId, purpose });
    }

    static async getStatus(): Promise<EdgeNodeStatus> {
        try {
            return await this.callAPI("STATUS", {});
        } catch (error: any) {
            return { connected: false, error: error.message };
        }
    }

    static async getActivity(limit = 50): Promise<ActivityEntry[]> {
        try {
            const data = await this.callAPI("ACTIVITY", { limit });
            return data.activity;
        } catch {
            return [];
        }
    }
}
