import { z } from "zod";

const HOUR = 3_600_000;
const BLOCKED_LEAD_STATUSES = new Set(["opt_out", "unsubscribed", "do_not_contact", "dnc", "bounced", "lost", "closed_lost", "stopped"]);
const BLOCKED_OUTCOMES = new Set(["not_interested", "wrong_person", "meeting_booked", "lost"]);

export const replySubsequenceConfigSchema = z.object({
    enabled: z.boolean(),
    steps: z.array(z.number().int().min(0).max(720)).min(1).max(4),
}).strict().refine(({ steps }) => steps.every((hour, index) => index === 0 || hour - steps[index - 1]! >= 24), {
    message: "Reply follow-up steps must be at least 24 hours apart.",
    path: ["steps"],
});

const campaignConfigSchema = z.object({
    dripPlaybook: z.object({ replySubsequence: replySubsequenceConfigSchema }),
});

export function readReplySubsequenceConfig(aiConfig: unknown) {
    const parsed = campaignConfigSchema.safeParse(aiConfig);
    const config = parsed.success ? parsed.data.dripPlaybook.replySubsequence : null;
    return config?.enabled ? config : null;
}

type HoldReason = "account_cooldown" | "mailbox_limit" | "send_window";
type DecisionReason = "new_inbound" | "thread_changed" | "classification_changed" | "classification_uncertain"
    | "classification_unavailable" | "body_missing" | "opt_out_language" | "approval_stale" | "hold_too_long" | "sending_time_changed" | "dispatch_unconfirmed";
type BlockReason = "feature_off" | "plan_inactive" | "recipient_suppressed" | "lead_blocked" | "outcome_blocked"
    | "recipient_changed" | "mailbox_unavailable" | "campaign_paused" | "step_expired";

export type ReplySubsequenceDecision =
    | { kind: "send" }
    | { kind: "decision"; reason: DecisionReason }
    | { kind: "block"; reason: BlockReason }
    | { kind: "cancel"; reason: "approver_left" }
    | { kind: "hold"; reason: HoldReason | "step_spacing"; until: number };

export function decideReplySubsequence(input: {
    now: number;
    approvalAt: number;
    expiresAt: number;
    lastSentAt: number | null;
    enabled: boolean;
    planActive: boolean;
    leadStatus: string;
    outcome: string | null;
    recipientMatches: boolean;
    mailboxMatches: boolean;
    campaignPaused: boolean;
    suppressed: boolean;
    approverActive: boolean;
    newerInbound: boolean;
    threadChanged: boolean;
    bodyAvailable: boolean;
    optOutLanguage: boolean;
    classification: string | null;
    originalClassification: string;
    confidence: number;
    minimumConfidence?: number;
    approvalHours?: number;
    holdHours?: number;
    minSpacingHours?: number;
    holdUntil?: number;
    holdReason?: HoldReason;
    heldSince?: number;
}): ReplySubsequenceDecision {
    if (!input.approverActive) return { kind: "cancel", reason: "approver_left" };
    if (!input.planActive) return { kind: "block", reason: "plan_inactive" };
    if (!input.enabled) return { kind: "block", reason: "feature_off" };
    if (input.optOutLanguage) return { kind: "decision", reason: "opt_out_language" };
    if (input.suppressed) return { kind: "block", reason: "recipient_suppressed" };
    if (BLOCKED_LEAD_STATUSES.has(input.leadStatus.toLowerCase())) return { kind: "block", reason: "lead_blocked" };
    if (input.outcome && BLOCKED_OUTCOMES.has(input.outcome.toLowerCase())) return { kind: "block", reason: "outcome_blocked" };
    if (!input.recipientMatches) return { kind: "block", reason: "recipient_changed" };
    if (!input.mailboxMatches) return { kind: "block", reason: "mailbox_unavailable" };
    if (input.campaignPaused) return { kind: "block", reason: "campaign_paused" };
    if (!input.bodyAvailable) return { kind: "decision", reason: "body_missing" };
    if (input.newerInbound) return { kind: "decision", reason: "new_inbound" };
    if (input.threadChanged) return { kind: "decision", reason: "thread_changed" };
    if (!input.classification || input.classification === "UNSURE") return { kind: "decision", reason: "classification_unavailable" };
    if (!(input.confidence >= (input.minimumConfidence ?? 0.7))) return { kind: "decision", reason: "classification_uncertain" };
    if (input.classification !== input.originalClassification) return { kind: "decision", reason: "classification_changed" };
    if (input.now - input.approvalAt > (input.approvalHours ?? 72) * HOUR) return { kind: "decision", reason: "approval_stale" };
    if (input.expiresAt <= input.now) return { kind: "block", reason: "step_expired" };
    if (input.holdUntil !== undefined && input.holdUntil > input.now) {
        if (input.now - (input.heldSince ?? input.now) >= (input.holdHours ?? 24) * HOUR) return { kind: "decision", reason: "hold_too_long" };
        return { kind: "hold", reason: input.holdReason ?? "account_cooldown", until: input.holdUntil };
    }
    const spacing = (input.minSpacingHours ?? 24) * HOUR;
    if (input.lastSentAt !== null && input.lastSentAt + spacing > input.now) {
        return { kind: "hold", reason: "step_spacing", until: input.lastSentAt + spacing };
    }
    return { kind: "send" };
}
