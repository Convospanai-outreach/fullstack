export type EdgeRuntimeStatus = "UP" | "DOWN" | "NOT_CONFIGURED";

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
