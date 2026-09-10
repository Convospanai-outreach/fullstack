import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";

const EDGE_NODE_URI = process.env['EDGE_NODE_URL'] || process.env['EDGE_NODE_URI'] || 'http://localhost:8000';

function edgeHeaders(extra: Record<string, string> = {}) {
    // NOTE: still a single shared secret across every physical node, unlike the
    // per-node signed heartbeats in edgeRuntime.ts. Per-node data-plane auth
    // (e.g. a per-team API key or the node's own signing key) is a separate,
    // larger change - not attempted here. This fix only resolves *which* node a
    // team's data-plane calls are routed to.
    const apiKey = process.env['EDGE_API_KEY'];
    return {
        ...extra,
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
    };
}

/**
 * Resolves which physical edge node a data-plane call should target.
 * A team's own paired EdgeNode.ipAddress wins when one exists and isn't
 * revoked; otherwise falls back to the single global EDGE_NODE_URI env var,
 * preserving today's single-node behavior for teams that haven't paired a
 * device (and for every call site that doesn't have a teamId in scope yet,
 * e.g. the boot-time verification in instrumentation.ts).
 */
async function resolveEdgeBaseUrl(teamId?: string): Promise<string> {
    if (teamId) {
        try {
            const node = await prisma.edgeNode.findUnique({
                where: { teamId },
                select: { ipAddress: true, revokedAt: true },
            });
            if (node?.ipAddress && !node.revokedAt) {
                return node.ipAddress.replace(/\/+$/, "");
            }
        } catch (error) {
            logger.error("[HardwareService] Failed to resolve team edge node, falling back to global endpoint", error);
        }
    }
    return EDGE_NODE_URI;
}

export interface SanitizeResponse {
    sanitized_text: string;
    token_map_id: string;
    metadata_tags?: Record<string, string>; // New: Semantic-Aware Tokenization
    stats: Record<string, number>;
}

export interface CritiqueResponse {
    status: 'APPROVED' | 'REJECTED' | 'ERROR';
    score: number;
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
    /**
     * Verifies that the physical hardware is present and matches the signature.
     * Throws an error if verification fails.
     */
    static async verifyHardwareIdentity(teamId?: string): Promise<void> {
        try {
            // detailed connection log removed for security

            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${baseUrl}/health`, {
                headers: edgeHeaders(),
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

    /**
     * Non-throwing connection check for dashboard display. Unlike
     * verifyHardwareIdentity(), this never throws - it reports the
     * connection state so the UI can show "disconnected" instead of erroring.
     */
    static async getStatus(teamId?: string): Promise<EdgeNodeStatus> {
        const startedAt = Date.now();
        try {
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(`${baseUrl}/health`, {
                headers: edgeHeaders(),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const latencyMs = Date.now() - startedAt;

            if (!response.ok) {
                return { connected: false, latencyMs, error: `HTTP ${response.status}` };
            }

            const data = await response.json();
            const expectedSig = process.env['HARDWARE_SIGNATURE'];
            return {
                connected: data.status === 'ONLINE',
                hardwareId: data.hardware_id,
                signatureMatch: expectedSig ? data.hardware_id === expectedSig : undefined,
                latencyMs,
            };
        } catch (error: any) {
            return { connected: false, latencyMs: Date.now() - startedAt, error: error.message };
        }
    }

    /**
     * Recent node activity feed - function name, entity types/counts touched,
     * timestamps. The edge node never includes plaintext PII in this response.
     */
    static async getActivity(limit = 50, teamId?: string): Promise<ActivityEntry[]> {
        try {
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${baseUrl}/activity?limit=${limit}`, {
                headers: edgeHeaders(),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            return data.map((entry: any) => ({
                id: entry.id,
                function: entry.function,
                entityTypes: entry.entityTypes,
                entityCount: entry.entityCount,
                sessionId: entry.sessionId,
                createdAt: entry.createdAt,
            }));
        } catch (error: any) {
            logger.error("Hardware Activity Fetch Error:", error);
            return [];
        }
    }

    static async sanitize(text: string, teamId?: string): Promise<SanitizeResponse> {
        try {
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${baseUrl}/v1/sanitize`, {
                method: 'POST',
                headers: edgeHeaders({ 'Content-Type': 'application/json' }),
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

    static async critique(text: string, context?: string, teamId?: string): Promise<CritiqueResponse> {
        try {
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${baseUrl}/v1/critique`, {
                method: 'POST',
                headers: edgeHeaders({ 'Content-Type': 'application/json' }),
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

    static async search(query: string, teamId?: string): Promise<SearchResult[]> {
        try {
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${baseUrl}/search`, {
                method: 'POST',
                headers: edgeHeaders({ 'Content-Type': 'application/json' }),
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

    static async execute(action: string, payload: Record<string, any>, teamId?: string): Promise<boolean> {
        try {
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${baseUrl}/execute`, {
                method: 'POST',
                headers: edgeHeaders({ 'Content-Type': 'application/json' }),
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

    static async saveWorkflow(workflow: Workflow, teamId?: string): Promise<void> {
        try {
            logger.info("[HardwareService] Saving Workflow to Sovereign Edge Storage...");
            const baseUrl = await resolveEdgeBaseUrl(teamId ?? workflow.teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${baseUrl}/workflows/save`, {
                method: 'POST',
                headers: edgeHeaders({ 'Content-Type': 'application/json' }),
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

    static async getWorkflows(teamId?: string): Promise<Workflow[]> {
        try {
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${baseUrl}/workflows`, { headers: edgeHeaders(), signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            return await res.json();
        } catch (error) {
            return [];
        }
    }

    static async setComplianceMode(region: 'INDIA' | 'EU', teamId?: string): Promise<void> {
        try {
            logger.info(`[HardwareService] Enforcing Region Compliance: ${region}`);
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${baseUrl}/compliance/mode`, {
                method: 'POST',
                headers: edgeHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ region }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        } catch (error) {
            logger.error("Failed to set compliance mode on Edge Node");
        }
    }

    static async tokenBelongsToTeam(
        maskedId: string,
        teamId: string,
        prismaClient: {
            lead: { findFirst(args: { where: { teamId: string; OR: Array<{ email?: string; phone?: string }> }; select: { id: true } }): Promise<{ id: string } | null> };
            scrapingJob: { findMany(args: { where: { teamId: string }; select: { tokenMap: true } }): Promise<Array<{ tokenMap: unknown }>> };
        },
    ): Promise<boolean> {
        const lead = await prismaClient.lead.findFirst({
            where: { teamId, OR: [{ email: maskedId }, { phone: maskedId }] },
            select: { id: true },
        });
        if (lead) return true;

        const jobs = await prismaClient.scrapingJob.findMany({ where: { teamId }, select: { tokenMap: true } });
        return jobs.some((job) => job.tokenMap && typeof job.tokenMap === "object" && Object.prototype.hasOwnProperty.call(job.tokenMap, maskedId));
    }

    static async reIdentify(maskedId: string, purpose: string, teamId?: string): Promise<IdentityResponse> {
        try {
            logger.info(`[HardwareService] Re-identifying ${maskedId} for purpose: ${purpose}`);
            const baseUrl = await resolveEdgeBaseUrl(teamId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${baseUrl}/v1/reidentify`, {
                method: 'POST',
                headers: edgeHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ token: maskedId }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            return { original: data.original };
        } catch (error: any) {
            logger.error(`[HardwareService] Re-identification failed: ${error.message}`);
            throw new Error(`Identity Resolution Failed: ${error.message}. Secure enclave unreachable.`);
        }
    }
}

