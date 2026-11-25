import type { Prisma } from "@prisma/client";

type MailboxQuota = { id: string; dailyLimit: number; isWarmingUp: boolean; warmupDay: number };
const SENT = ["sent", "delivered", "opened", "clicked", "replied", "bounced", "complained", "unsubscribed"];

// capApplies is true only while the reputation guard is on and the mailbox has an open incident.
// Otherwise the limit is exactly the pre-guard one: the warmup ramp while warming up, else dailyLimit.
export async function mailboxSendLimit(countSends: (where: Prisma.EmailWhereInput) => Promise<number>, mailbox: MailboxQuota, today: Date, capApplies = false) {
    const ramp = Math.min(mailbox.dailyLimit, 5 + 5 * mailbox.warmupDay);
    if (mailbox.isWarmingUp) return { limit: ramp, growthLimited: false };
    if (!capApplies || ramp >= mailbox.dailyLimit) return { limit: mailbox.dailyLimit, growthLimited: false };
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    const window = { gte: start, lt: today };
    const sends = await countSends({ mailboxId: mailbox.id, OR: [
        { createdAt: window, status: { in: SENT } },
        { events: { some: { type: "SENT", createdAt: window } } },
    ] });
    const limit = Math.min(mailbox.dailyLimit, Math.max(ramp, Math.floor(1.5 * sends / 7)));
    return { limit, growthLimited: limit < mailbox.dailyLimit };
}
