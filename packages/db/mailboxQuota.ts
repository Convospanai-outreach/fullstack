import type { Prisma } from "@prisma/client";

type MailboxQuota = { id: string; dailyLimit: number; isWarmingUp: boolean; warmupDay: number };
const SENT = ["sent", "delivered", "opened", "clicked", "replied", "bounced", "complained", "unsubscribed"];

export async function mailboxSendLimit(countSends: (where: Prisma.EmailWhereInput) => Promise<number>, mailbox: MailboxQuota, today: Date) {
    const ramp = Math.min(mailbox.dailyLimit, 5 + 5 * mailbox.warmupDay);
    if (mailbox.isWarmingUp || ramp >= mailbox.dailyLimit) return { limit: ramp, growthLimited: false };
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
