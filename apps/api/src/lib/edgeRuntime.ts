import { createHash, createVerify } from "node:crypto";

export type EdgeRuntimeStatus = "UP" | "DOWN" | "NOT_CONFIGURED";
export type EdgeNodeLifecycleStatus =
    | "not_configured"
    | "pairing_required"
    | "online"
    | "degraded"
    | "disconnected"
    | "revoked";

export class EdgeRuntimeError extends Error {
    constructor(
        public code:
            | "EDGE_NODE_REQUIRED"
            | "EDGE_NODE_OFFLINE"
            | "EDGE_NODE_REVOKED"
            | "EDGE_ATTESTATION_FAILED"
            | "EDGE_DECRYPTION_UNAVAILABLE",
        message: string,
        public statusCode: number = 503,
    ) {
        super(message);
    }
}

export interface EdgeRuntimeAvailability {
    configured: boolean;
    available: boolean;
    optional: boolean;
    required: boolean;
    status: EdgeRuntimeStatus;
    message: string;
    endpoint?: string;
    latencyMs?: number;
}

export interface EdgeNodeRecordLike {
    status?: string | null;
    attestationStatus?: string | null;
    lastSeenAt?: Date | string | null;
    revokedAt?: Date | string | null;
    publicKey?: string | null;
    vaultState?: string | null;
}

export interface EdgeNodeStatusSnapshot {
    status: EdgeNodeLifecycleStatus;
    online: boolean;
    failClosed: boolean;
    reason?: string;
    staleForMs?: number;
}

export interface EdgeRequestSignatureInput {
    publicKeyPem: string;
    rawBody: string;
    timestamp: string;
    nonce: string;
    signatureHex: string;
    now?: Date;
    maxSkewMs?: number;
}

export const DEFAULT_EDGE_NODE_OFFLINE_TIMEOUT_SECONDS = 45;

function readBooleanEnv(name: string): boolean | undefined {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value) {
        return undefined;
    }

    if (["1", "true", "yes", "on"].includes(value)) {
        return true;
    }

    if (["0", "false", "no", "off"].includes(value)) {
        return false;
    }

    return undefined;
}

export function isEdgeRuntimeOptional(): boolean {
    const explicit = readBooleanEnv("EDGE_NODE_OPTIONAL");
    if (typeof explicit === "boolean") {
        return explicit;
    }

    if (process.env["STRICT_SOVEREIGNTY"] === "true") {
        return false;
    }

    return true;
}

export function isEdgeRuntimeRequired(): boolean {
    return !isEdgeRuntimeOptional();
}

export function getEdgeNodeOfflineTimeoutMs(): number {
    const raw = Number(process.env["EDGE_NODE_OFFLINE_TIMEOUT_SECONDS"]);
    const seconds = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EDGE_NODE_OFFLINE_TIMEOUT_SECONDS;
    return seconds * 1000;
}

export function isEdgePiiModeEnabled(): boolean {
    return process.env["EDGE_PII_MODE"] === "edge_only" || process.env["ALLOW_CLOUD_PII"] === "false";
}

export function hashHardwareFingerprint(rawFingerprint: string): string {
    return createHash("sha256").update(rawFingerprint).digest("hex");
}

function coerceDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getEdgeNodeStatusSnapshot(
    node: EdgeNodeRecordLike | null | undefined,
    options: { now?: Date; timeoutMs?: number } = {},
): EdgeNodeStatusSnapshot {
    if (!node) {
        return {
            status: isEdgePiiModeEnabled() ? "pairing_required" : "not_configured",
            online: false,
            failClosed: isEdgePiiModeEnabled(),
            reason: isEdgePiiModeEnabled() ? "EDGE_NODE_REQUIRED" : "EDGE_NODE_NOT_CONFIGURED",
        };
    }

    if (node.revokedAt || node.status === "REVOKED") {
        return {
            status: "revoked",
            online: false,
            failClosed: true,
            reason: "EDGE_NODE_REVOKED",
        };
    }

    if (node.attestationStatus === "FAILED") {
        return {
            status: "degraded",
            online: false,
            failClosed: true,
            reason: "EDGE_ATTESTATION_FAILED",
        };
    }

    const now = options.now ?? new Date();
    const timeoutMs = options.timeoutMs ?? getEdgeNodeOfflineTimeoutMs();
    const lastSeenAt = coerceDate(node.lastSeenAt);

    if (!lastSeenAt) {
        return {
            status: "pairing_required",
            online: false,
            failClosed: true,
            reason: "EDGE_NODE_HEARTBEAT_MISSING",
        };
    }

    const staleForMs = Math.max(0, now.getTime() - lastSeenAt.getTime());
    if (staleForMs > timeoutMs || node.status === "DISCONNECTED" || node.status === "OFFLINE") {
        return {
            status: "disconnected",
            online: false,
            failClosed: true,
            reason: "EDGE_NODE_OFFLINE",
            staleForMs,
        };
    }

    if (node.attestationStatus !== "TRUSTED" || !node.publicKey) {
        return {
            status: "degraded",
            online: false,
            failClosed: true,
            reason: "EDGE_ATTESTATION_REQUIRED",
            staleForMs,
        };
    }

    return {
        status: "online",
        online: true,
        failClosed: false,
        staleForMs,
    };
}

export function verifyEdgeRequestSignature(input: EdgeRequestSignatureInput): boolean {
    const now = input.now ?? new Date();
    const issuedAt = Number(input.timestamp);
    if (!Number.isFinite(issuedAt)) return false;

    const maxSkewMs = input.maxSkewMs ?? 5 * 60 * 1000;
    if (Math.abs(now.getTime() - issuedAt) > maxSkewMs) {
        return false;
    }

    const actual = Buffer.from(input.signatureHex, "hex");
    if (actual.length === 0) return false;

    const verifier = createVerify("SHA256");
    verifier.update(`${input.timestamp}.${input.nonce}.${input.rawBody}`);
    verifier.end();

    try {
        return verifier.verify(input.publicKeyPem, actual);
    } catch {
        return false;
    }
}

export async function requireEdgePiiAvailable(
    teamId: string,
    prismaClient: {
        edgeNode: {
            findUnique(args: { where: { teamId: string } }): Promise<EdgeNodeRecordLike | null>;
        };
    },
): Promise<EdgeNodeStatusSnapshot> {
    const node = await prismaClient.edgeNode.findUnique({ where: { teamId } });
    const snapshot = getEdgeNodeStatusSnapshot(node);

    if (snapshot.status === "not_configured" && !isEdgePiiModeEnabled()) {
        return snapshot;
    }

    if (!snapshot.online) {
        const reason = snapshot.reason || "EDGE_NODE_OFFLINE";
        if (reason === "EDGE_NODE_REVOKED") {
            throw new EdgeRuntimeError("EDGE_NODE_REVOKED", "Edge node is revoked.", 403);
        }
        if (reason === "EDGE_ATTESTATION_FAILED" || reason === "EDGE_ATTESTATION_REQUIRED") {
            throw new EdgeRuntimeError("EDGE_ATTESTATION_FAILED", "Edge node attestation is not trusted.", 403);
        }
        throw new EdgeRuntimeError("EDGE_NODE_OFFLINE", "Edge node is required for PII operations and is unavailable.", 503);
    }

    if (node?.vaultState !== "UNLOCKED") {
        throw new EdgeRuntimeError("EDGE_DECRYPTION_UNAVAILABLE", "Edge vault is locked or unavailable.", 423);
    }

    return snapshot;
}

export function getConfiguredEdgeRuntimeEndpoint(): string | undefined {
    const endpoint =
        process.env["ON_PREM_AI_ENDPOINT"] ||
        process.env["EDGE_NODE_URI"] ||
        process.env["EDGE_NODE_URL"] ||
        process.env["PHI3_LOCAL_ENDPOINT"];

    return endpoint?.trim().replace(/\/$/, "") || undefined;
}

export async function getEdgeRuntimeAvailability(timeoutMs: number = 2500): Promise<EdgeRuntimeAvailability> {
    const endpoint = getConfiguredEdgeRuntimeEndpoint();
    const optional = isEdgeRuntimeOptional();

    if (!endpoint) {
        return {
            configured: false,
            available: false,
            optional,
            required: !optional,
            status: "NOT_CONFIGURED",
            message: optional
                ? "Optional edge runtime is not configured. Cloud fallback remains active."
                : "Edge runtime is required but not configured.",
        };
    }

    const startedAt = Date.now();

    try {
        const response = await fetch(`${endpoint}/health`, {
            method: "GET",
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
            return {
                configured: true,
                available: true,
                optional,
                required: !optional,
                status: "UP",
                message: "Edge runtime reachable.",
                endpoint,
                latencyMs: Date.now() - startedAt,
            };
        }

        return {
            configured: true,
            available: false,
            optional,
            required: !optional,
            status: "DOWN",
            message: optional
                ? `Optional edge runtime returned HTTP ${response.status}. Cloud fallback remains active.`
                : `Edge runtime returned HTTP ${response.status}.`,
            endpoint,
            latencyMs: Date.now() - startedAt,
        };
    } catch (error: any) {
        return {
            configured: true,
            available: false,
            optional,
            required: !optional,
            status: "DOWN",
            message: optional
                ? `Optional edge runtime unavailable: ${error?.message || "unreachable"}. Cloud fallback remains active.`
                : `Edge runtime unavailable: ${error?.message || "unreachable"}.`,
            endpoint,
            latencyMs: Date.now() - startedAt,
        };
    }
}
