export type EdgeHeartbeatState = "green" | "amber" | "red";

export interface EdgeHeartbeat {
    configured: boolean;
    state?: EdgeHeartbeatState;
    reason?: "revoked" | "attestation_failed" | "no_heartbeat" | null;
    lastSeenAt?: string | null;
    hardwareId?: string | null;
    runtimeVersion?: string | null;
    capabilities?: { tokenize: boolean; classify: boolean; generate: boolean; execute: boolean };
}

/** "just now", "2m ago", "3h ago", "2d ago"; "never" when there is no timestamp. */
export function formatHeartbeatAge(iso: string | null | undefined, now: number = Date.now()): string {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (!Number.isFinite(t)) return "never";
    const minutes = Math.floor(Math.max(0, now - t) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
