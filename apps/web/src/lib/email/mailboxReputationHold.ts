export type SendPurpose = "outreach" | "scheduled_reply" | "conversation_reply" | "warmup" | "transactional";

export function jsonObject(value: unknown): Record<string, import("@prisma/client").Prisma.JsonValue> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, import("@prisma/client").Prisma.JsonValue>
        : {};
}

export function mailboxSendingHold(metadata: unknown, teamSafety?: unknown, purpose: SendPurpose = "outreach") {
    const teamHold = jsonObject(jsonObject(jsonObject(teamSafety)["reputation"])["sendingHold"]);
    if (typeof teamHold["reason"] === "string") return "TEAM_SENDING_HOLD" as const;
    const hold = jsonObject(jsonObject(jsonObject(metadata)["reputation"])["sendingHold"]);
    if (typeof hold["reason"] !== "string") return null;
    return purpose !== "conversation_reply" || hold["blocksReplies"] === true ? "MAILBOX_REPUTATION_HOLD" as const : null;
}
