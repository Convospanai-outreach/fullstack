import { prisma } from "@/lib/db";
import { addCredits } from "@/lib/credits";

// A monthly subscription is one 30-day period (see the Razorpay and Stripe billing webhooks). A yearly one is paid
// once for 365 days and credited monthly: the first month's credits arrive with the payment, then one more every 30
// days until the paid period ends, 12 grants in all. Credits do not roll over, so a yearly subscriber never holds
// more than a month ahead and a refund or cancellation cannot leave a year of unused credits behind.
export const MONTHLY_PERIOD_DAYS = 30;
export const YEARLY_PERIOD_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 200;

/**
 * Grants the monthly credits that have fallen due on yearly subscriptions. Safe to run from several workers at
 * once and to repeat: a due grant is claimed by advancing nextCreditGrantAt only if it still holds the value that
 * was read, in the same transaction as the credit entry, and the entry's paymentId is unique per subscription and
 * due date. Stops for a subscription that is no longer active or whose paid year has ended.
 * @returns how many grants were made
 */
export async function grantDueYearlyCredits(now: Date = new Date()): Promise<number> {
    const due = await prisma.subscription.findMany({
        where: {
            billingInterval: "YEAR",
            status: "active",
            nextCreditGrantAt: { lte: now },
            currentPeriodEnd: { gt: now },
            teamId: { not: null },
        },
        orderBy: { nextCreditGrantAt: "asc" },
        take: BATCH_SIZE,
        select: {
            id: true,
            teamId: true,
            currentPeriodEnd: true,
            nextCreditGrantAt: true,
            plan: { select: { name: true, creditsPerMonth: true } },
        },
    });

    let granted = 0;
    for (const subscription of due) {
        const dueAt = subscription.nextCreditGrantAt;
        const teamId = subscription.teamId;
        if (!dueAt || !teamId) continue;

        // Following grants are counted from the due date, not from now, so a worker that was down for a while
        // still delivers every month that has passed.
        const following = new Date(dueAt.getTime() + MONTHLY_PERIOD_DAYS * DAY_MS);
        const nextCreditGrantAt = following < subscription.currentPeriodEnd ? following : null;

        try {
            const made = await prisma.$transaction(async (tx) => {
                const claim = await tx.subscription.updateMany({
                    where: { id: subscription.id, billingInterval: "YEAR", status: "active", nextCreditGrantAt: dueAt },
                    data: { nextCreditGrantAt },
                });
                if (claim.count !== 1) return false;
                await addCredits(
                    teamId,
                    subscription.plan.creditsPerMonth,
                    `${subscription.plan.name} plan monthly credits (yearly subscription)`,
                    { paymentId: `yearly_${subscription.id}_${dueAt.toISOString()}` },
                    "subscription",
                    tx
                );
                return true;
            });
            if (made) granted += 1;
        } catch (error: any) {
            // A unique paymentId clash means another worker already made this exact grant.
            if (error?.code !== "P2002") throw error;
        }
    }
    return granted;
}
