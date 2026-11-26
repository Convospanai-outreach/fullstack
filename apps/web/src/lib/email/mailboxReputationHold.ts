export type SendPurpose = "outreach" | "scheduled_reply" | "conversation_reply" | "warmup" | "transactional";

// The automatic reputation guard (evaluator, mailbox holds, growth cap, sender conversion) is off
// unless this is exactly "true". The superadmin team hold is a manual action and is always live.
export const mailboxReputationGuardEnabled = () => process.env["MAILBOX_REPUTATION_GUARD"] === "true";

export function jsonObject(value: unknown): Record<string, import("@prisma/client").Prisma.JsonValue> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, import("@prisma/client").Prisma.JsonValue>
        : {};
}

export function mailboxReputationIncidentOpen(metadata: unknown) {
    if (!mailboxReputationGuardEnabled()) return false;
    const state = jsonObject(jsonObject(metadata)["reputation"])["state"];
    return typeof state === "string" && state !== "RESOLVED" && state !== "DISMISSED";
}

export function mailboxSendingHold(metadata: unknown, teamSafety?: unknown, purpose: SendPurpose = "outreach") {
    const teamHold = jsonObject(jsonObject(jsonObject(teamSafety)["reputation"])["sendingHold"]);
    if (typeof teamHold["reason"] === "string") return "TEAM_SENDING_HOLD" as const;
    // A mailbox hold only applies while the guard is on, and never stops requested transactional mail.
    if (!mailboxReputationGuardEnabled() || purpose === "transactional") return null;
    const hold = jsonObject(jsonObject(jsonObject(metadata)["reputation"])["sendingHold"]);
    if (typeof hold["reason"] !== "string") return null;
    return purpose !== "conversation_reply" || hold["blocksReplies"] === true ? "MAILBOX_REPUTATION_HOLD" as const : null;
}
