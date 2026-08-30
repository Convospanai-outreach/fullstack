export enum ApprovalTier {
    AUTO = "AUTO",
    QUEUED = "QUEUED",
    HARD_BLOCK = "HARD_BLOCK"
}

// Executes immediately, no human review gate. Empty today: every actionType
// currently routed through ApprovalService already warrants a human look
// (that's why it calls this service at all). Add an entry here only once a
// specific actionType is verified safe to skip review entirely.
const AUTO_ACTION_TYPES = new Set<string>([]);

// Blocks unconditionally regardless of timeout; requires explicit reviewer action.
const HARD_BLOCK_ACTION_TYPES = new Set<string>([]);

const DEFAULT_QUEUED_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * Decides the HITL risk tier for an approval request.
 *
 * `forceHardBlock` lets an upstream signal (guardrail failure, compliance
 * flag, spend-anomaly detection) escalate a normally-queued action type to
 * HARD_BLOCK without needing its own entry in the static allowlist above.
 */
export function resolveApprovalTier(actionType: string, options: { forceHardBlock?: boolean } = {}): ApprovalTier {
    if (options.forceHardBlock || HARD_BLOCK_ACTION_TYPES.has(actionType)) {
        return ApprovalTier.HARD_BLOCK;
    }
    if (AUTO_ACTION_TYPES.has(actionType)) {
        return ApprovalTier.AUTO;
    }
    return ApprovalTier.QUEUED;
}

export function computeAutoDenyAt(tier: ApprovalTier, now: Date = new Date()): Date | null {
    if (tier !== ApprovalTier.QUEUED) return null;
    return new Date(now.getTime() + DEFAULT_QUEUED_TIMEOUT_MS);
}
