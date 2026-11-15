import { prisma } from "@/lib/db";
import { NotificationDispatcher } from "@/lib/notifications";

// Razorpay subscriptions are one-off orders: nothing renews them, so a customer who does not come back simply
// lapses. A reminder goes out once per paid period, with the yearly price as the offer. Stripe subscriptions renew
// on their own and get no reminder. The list price is the offer: no extra discount is invented here.
export const MONTHLY_REMINDER_DAYS = 3;
export const YEARLY_REMINDER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

type ReminderInput = {
    billingInterval: string;
    planName: string;
    periodEnd: Date;
    monthlyPrice: number;
    yearlyPrice: number | null;
    pricingUrl: string;
};

function rupees(paise: number): string {
    return `Rs.${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/** Whole percent a year paid at once saves against twelve monthly payments, or 0 when there is no saving. */
export function yearlySavingPercent(monthlyPrice: number, yearlyPrice: number | null): number {
    if (!yearlyPrice || monthlyPrice <= 0) return 0;
    const percent = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
    return percent > 0 ? percent : 0;
}

export function renewalReminderText(input: ReminderInput): { title: string; message: string } {
    const date = input.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    const saving = yearlySavingPercent(input.monthlyPrice, input.yearlyPrice);
    const yearly = input.billingInterval === "YEAR";

    if (yearly) {
        const offer = input.yearlyPrice
            ? ` Renew for another 12 months at ${rupees(input.yearlyPrice)} plus GST${saving ? `, ${saving}% less than paying monthly` : ""}.`
            : "";
        return {
            title: `Your ${input.planName} yearly plan ends on ${date}`,
            message: `Your ${input.planName} yearly plan ends on ${date}.${offer} Renew before then to keep your credits and automations running: ${input.pricingUrl}`,
        };
    }

    const offer = input.yearlyPrice && saving
        ? ` Offer: pay for a full year at once, ${rupees(input.yearlyPrice)} plus GST instead of ${rupees(input.monthlyPrice * 12)} for twelve months, and save ${saving}%.`
        : "";
    return {
        title: `Your ${input.planName} plan ends on ${date}`,
        message: `Your ${input.planName} plan ends on ${date}. Renew before then to keep your credits and automations running: ${input.pricingUrl}${offer}`,
    };
}

/**
 * Sends the renewal reminder that has fallen due on Razorpay subscriptions: 3 days before a monthly period ends and
 * 14 days before a yearly one. A subscription is claimed by recording the period end it was reminded for, so a repeat
 * run, a second worker, or a renewal that moves the period end never double-sends or skips the next period.
 * @returns how many reminders were sent
 */
export async function sendRenewalReminders(now: Date = new Date()): Promise<number> {
    const baseUrl = (process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || process.env["NEXT_PUBLIC_APP_URL"] || "").replace(/\/$/, "");
    const pricingUrl = `${baseUrl}/pricing`;

    const candidates = await prisma.subscription.findMany({
        where: {
            gateway: "RAZORPAY",
            status: "active",
            currentPeriodEnd: { gt: now, lte: new Date(now.getTime() + YEARLY_REMINDER_DAYS * DAY_MS) },
            plan: { monthlyPrice: { gt: 0 } },
        },
        orderBy: { currentPeriodEnd: "asc" },
        take: BATCH_SIZE,
        select: {
            id: true,
            userId: true,
            billingInterval: true,
            currentPeriodEnd: true,
            renewalReminderFor: true,
            plan: { select: { name: true, monthlyPrice: true, yearlyPrice: true } },
        },
    });

    let sent = 0;
    for (const subscription of candidates) {
        const yearly = subscription.billingInterval === "YEAR";
        const windowDays = yearly ? YEARLY_REMINDER_DAYS : MONTHLY_REMINDER_DAYS;
        if (subscription.currentPeriodEnd.getTime() - now.getTime() > windowDays * DAY_MS) continue;
        if (subscription.renewalReminderFor && subscription.renewalReminderFor.getTime() === subscription.currentPeriodEnd.getTime()) continue;

        const claim = await prisma.subscription.updateMany({
            where: {
                id: subscription.id,
                status: "active",
                currentPeriodEnd: subscription.currentPeriodEnd,
                OR: [{ renewalReminderFor: null }, { renewalReminderFor: { not: subscription.currentPeriodEnd } }],
            },
            data: { renewalReminderFor: subscription.currentPeriodEnd },
        });
        if (claim.count !== 1) continue;

        const { title, message } = renewalReminderText({
            billingInterval: subscription.billingInterval,
            planName: subscription.plan.name,
            periodEnd: subscription.currentPeriodEnd,
            monthlyPrice: subscription.plan.monthlyPrice,
            yearlyPrice: subscription.plan.yearlyPrice,
            pricingUrl,
        });
        await NotificationDispatcher.send(subscription.userId, "BILLING", title, message, { kind: "renewal_reminder" });
        sent += 1;
    }
    return sent;
}
