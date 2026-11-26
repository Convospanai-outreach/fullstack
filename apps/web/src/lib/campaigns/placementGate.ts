import { prisma } from "@/lib/db";
import { jsonObject, mailboxSendingHold } from "@/lib/email/mailboxReputationHold";

// Campaign start gate for the inbox placement check (apps/api inboxPlacementCheck.ts writes the result to
// ConnectedMailbox.metadata.placement). Only a fresh red result that no admin accepted blocks a start. A mailbox that
// was never checked, a stale check, a check still running and anything unreadable never block, so turning this on
// cannot stop teams that have not run a check yet. Keep in step with apps/api/src/lib/campaigns/placementGate.ts.
export const PLACEMENT_FRESH_DAYS = 14;
const DAY_MS = 86_400_000;

export type PlacementGate =
    | { allowed: true }
    | { allowed: false; status: 409; body: { error: string; code: "PLACEMENT_RED" | "TEAM_SENDING_HOLD" | "MAILBOX_REPUTATION_HOLD"; mailboxes: { id: string; email: string }[] } };

export function isBlockingPlacement(metadata: unknown, now = new Date()): boolean {
    const placement = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>)["placement"] : null;
    if (!placement || typeof placement !== "object") return false;
    const p = placement as { status?: unknown; checkedAt?: unknown; verdict?: { level?: unknown } | null; override?: unknown };
    if (p.status !== "done" || p.verdict?.level !== "red" || p.override) return false;
    const checkedAt = typeof p.checkedAt === "string" ? Date.parse(p.checkedAt) : Number.NaN;
    return Number.isFinite(checkedAt) && now.getTime() - checkedAt <= PLACEMENT_FRESH_DAYS * DAY_MS;
}

// With no explicit senders, outreach can use an eligible mailbox from the team's pool.
export async function checkPlacementGate(teamId: string, campaignId: string, now = new Date()): Promise<PlacementGate> {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
    if (mailboxSendingHold(null, team?.sendSafety) === "TEAM_SENDING_HOLD") {
        return { allowed: false, status: 409, body: {
            error: "Sending is on hold for this team.", code: "TEAM_SENDING_HOLD", mailboxes: [],
        } };
    }
    const [campaign, sequences] = await Promise.all([
        prisma.campaign.findFirst({ where: { id: campaignId, teamId }, select: { aiConfig: true } }),
        prisma.campaignSequence.findMany({ where: { teamId, campaignId }, select: { senderMailboxIds: true } }),
    ]);
    const campaignSender = jsonObject(campaign?.aiConfig)["senderMailboxId"];
    const chosen = [...new Set([
        ...(typeof campaignSender === "string" && campaignSender ? [campaignSender] : []),
        ...sequences.flatMap((sequence) => sequence.senderMailboxIds),
    ])];
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: chosen.length ? { teamId, status: "CONNECTED", id: { in: chosen } } : { teamId, status: "CONNECTED" },
        select: { id: true, email: true, metadata: true },
    });
    const held = mailboxes.filter((mailbox) => mailboxSendingHold(mailbox.metadata) === "MAILBOX_REPUTATION_HOLD");
    if (held.length && (chosen.length || held.length === mailboxes.length)) {
        return { allowed: false, status: 409, body: {
            error: "A campaign sender is on hold. Review it in Settings > Domain Health before starting.",
            code: "MAILBOX_REPUTATION_HOLD",
            mailboxes: held.map(({ id, email }) => ({ id, email })),
        } };
    }
    const red = mailboxes.filter((mailbox) => !held.includes(mailbox) && isBlockingPlacement(mailbox.metadata, now));
    if (red.length === 0) return { allowed: true };
    const names = red.map((m) => m.email).join(", ");
    return {
        allowed: false,
        status: 409,
        body: {
            error: `The inbox placement check found a problem with ${names}: test emails went to spam or failed authentication. Fix it and run the check again in Settings > Mailboxes, or an admin can accept the result there.`,
            code: "PLACEMENT_RED",
            mailboxes: red.map(({ id, email }) => ({ id, email })),
        },
    };
}
