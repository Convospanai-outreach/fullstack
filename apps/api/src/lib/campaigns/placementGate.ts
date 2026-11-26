import { prisma } from "@/lib/db";

// Campaign start gate for the inbox placement check (apps/api inboxPlacementCheck.ts writes the result to
// ConnectedMailbox.metadata.placement). Only a fresh red result that no admin accepted blocks a start. A mailbox that
// was never checked, a stale check, a check still running and anything unreadable never block, so turning this on
// cannot stop teams that have not run a check yet. Keep in step with apps/web/src/lib/campaigns/placementGate.ts.
export const PLACEMENT_FRESH_DAYS = 14;
const DAY_MS = 86_400_000;

export type PlacementGate =
    | { allowed: true }
    | { allowed: false; status: 409; body: { error: string; code: "PLACEMENT_RED"; mailboxes: { id: string; email: string }[] } };

export function isBlockingPlacement(metadata: unknown, now = new Date()): boolean {
    const placement = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>)["placement"] : null;
    if (!placement || typeof placement !== "object") return false;
    const p = placement as { status?: unknown; checkedAt?: unknown; verdict?: { level?: unknown } | null; override?: unknown };
    if (p.status !== "done" || p.verdict?.level !== "red" || p.override) return false;
    const checkedAt = typeof p.checkedAt === "string" ? Date.parse(p.checkedAt) : Number.NaN;
    return Number.isFinite(checkedAt) && now.getTime() - checkedAt <= PLACEMENT_FRESH_DAYS * DAY_MS;
}

// The mailboxes this campaign can send from: its sequences' chosen senders, or every connected mailbox when none
// are chosen (sends then pick any of them).
export async function checkPlacementGate(teamId: string, campaignId: string, now = new Date()): Promise<PlacementGate> {
    const sequences = await prisma.campaignSequence.findMany({ where: { teamId, campaignId }, select: { senderMailboxIds: true } });
    const chosen = [...new Set(sequences.flatMap((s) => s.senderMailboxIds))];
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: chosen.length ? { teamId, status: "CONNECTED", id: { in: chosen } } : { teamId, status: "CONNECTED" },
        select: { id: true, email: true, metadata: true },
    });
    const red = mailboxes.filter((m) => isBlockingPlacement(m.metadata, now));
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
