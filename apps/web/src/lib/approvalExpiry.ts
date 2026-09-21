// Pure helpers for the Approvals UI's auto-deny countdown. Kept React-free so
// they can be unit-tested directly. EXPIRY_WARN_WINDOW_MS mirrors the API's
// ApprovalService (apps/api .../governance/ApprovalService.ts): a QUEUED request
// within this many ms of autoDenyAt is "expiring soon" here, which is also when
// the reviewer gets a pre-deny warning notification (F-07).
export const EXPIRY_WARN_WINDOW_MS = 6 * 60 * 60 * 1000;

export type ExpiryState = "none" | "expired" | "soon" | "later";

/**
 * Classifies a QUEUED approval's auto-deny deadline. "none" for requests with no
 * deadline (AUTO/HARD_BLOCK, or a legacy null autoDenyAt); "expired" once past;
 * "soon" inside EXPIRY_WARN_WINDOW_MS; "later" otherwise.
 */
export function getExpiryState(autoDenyAt?: string | null, now: number = Date.now()): ExpiryState {
    if (!autoDenyAt) return "none";
    const msLeft = new Date(autoDenyAt).getTime() - now;
    if (Number.isNaN(msLeft)) return "none";
    if (msLeft <= 0) return "expired";
    if (msLeft <= EXPIRY_WARN_WINDOW_MS) return "soon";
    return "later";
}

/** Coarse "time remaining" label (minutes / hours / days) for the countdown. */
export function formatTimeLeft(autoDenyAt: string, now: number = Date.now()): string {
    const ms = Math.max(0, new Date(autoDenyAt).getTime() - now);
    if (ms < 60 * 60 * 1000) return `${Math.max(1, Math.round(ms / (60 * 1000)))}m`;
    if (ms < 24 * 60 * 60 * 1000) return `${Math.round(ms / (60 * 60 * 1000))}h`;
    return `${Math.round(ms / (24 * 60 * 60 * 1000))}d`;
}
