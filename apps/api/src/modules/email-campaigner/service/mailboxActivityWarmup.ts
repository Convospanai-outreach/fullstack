import type { ConnectedMailbox, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { captureException } from "@/lib/sentry";
import { notifyOwners } from "@/modules/overseer/domainWatch";
import { DAY_MS, fixUrl } from "@/modules/overseer/mailboxReputation";
import { jsonObject } from "@/modules/overseer/mailboxReputationHold";

const SENT_STATUSES = ["sent", "delivered", "opened", "clicked", "replied", "bounced", "complained", "unsubscribed"];
type HoldReason = "low_volume" | "bounces" | "complaints" | "awaiting_health";
type WarmupState = { evaluatedDay?: string; idleAnchor?: string; holdReason?: HoldReason | null };
type Mailbox = Pick<ConnectedMailbox, "id" | "teamId" | "email" | "dailyLimit" | "isWarmingUp" |
    "warmupDay" | "warmupTargetDays" | "warmupLastAdvancedAt" | "metadata" | "updatedAt" | "createdAt">;

export function readWarmupState(metadata: unknown) {
    return jsonObject(jsonObject(metadata)["warmup"]) as WarmupState;
}

async function lastRealSend(mailbox: Mailbox) {
    const [email, event] = await Promise.all([
        prisma.email.findFirst({
            where: { mailboxId: mailbox.id, status: { in: SENT_STATUSES } },
            orderBy: { createdAt: "desc" }, select: { createdAt: true },
        }),
        prisma.emailEvent.findFirst({
            where: { teamId: mailbox.teamId, mailboxId: mailbox.id, type: "SENT", emailId: { not: null } },
            orderBy: { createdAt: "desc" }, select: { createdAt: true },
        }),
    ]);
    if (!email) return event?.createdAt;
    return event && event.createdAt > email.createdAt ? event.createdAt : email.createdAt;
}

async function previousDay(mailbox: Mailbox, today: Date) {
    const window = { gte: new Date(today.getTime() - DAY_MS), lt: today };
    const count = (where: Prisma.EmailWhereInput) => prisma.email.count({ where: { mailboxId: mailbox.id, ...where } });
    const [sent, bounces, complaints] = await Promise.all([
        count({ OR: [
            { createdAt: window, status: { in: SENT_STATUSES }, events: { none: { type: "SENT" } } },
            { events: { some: { type: "SENT", createdAt: window } } },
        ] }),
        count({ OR: [
            { bouncedAt: window },
            { events: { some: { type: { in: ["BOUNCED", "BOUNCE"] }, createdAt: window } } },
        ] }),
        count({ events: { some: { type: "COMPLAINED", createdAt: window } } }),
    ]);
    return { sent, bounces, complaints };
}

async function save(mailbox: Mailbox, state: WarmupState, warmupDay: number, warming: boolean, now: Date) {
    const advancedAt = warmupDay === mailbox.warmupDay ? mailbox.warmupLastAdvancedAt : now;
    const priorState = JSON.stringify(jsonObject(mailbox.metadata)["warmup"] ?? null);
    return prisma.$executeRaw`
        UPDATE "ConnectedMailbox"
        SET "metadata" = jsonb_set(
                CASE WHEN jsonb_typeof("metadata") = 'object' THEN "metadata" ELSE '{}'::jsonb END,
                '{warmup}', ${JSON.stringify(state)}::jsonb, true),
            "warmupDay" = ${warmupDay}, "isWarmingUp" = ${warming},
            "warmupLastAdvancedAt" = ${advancedAt}, "updatedAt" = now()
        WHERE "id" = ${mailbox.id} AND "teamId" = ${mailbox.teamId} AND "status" = 'CONNECTED'
            AND "updatedAt" = ${mailbox.updatedAt}
            AND "warmupDay" = ${mailbox.warmupDay} AND "isWarmingUp" = ${mailbox.isWarmingUp}
            AND COALESCE("metadata"->'warmup', 'null'::jsonb) = ${priorState}::jsonb`;
}

async function advance(mailbox: Mailbox, today: Date, now: Date) {
    const state = readWarmupState(mailbox.metadata);
    const lastSend = await lastRealSend(mailbox);
    const activity = lastSend ?? mailbox.createdAt;
    const idleDays = Math.floor((now.getTime() - activity.getTime()) / DAY_MS);
    const day = today.toISOString();
    const notify = (title: string, message: string, key: string) => notifyOwners(mailbox.teamId, title, message, {
        href: new URL("/settings/mailboxes", fixUrl(mailbox.id)).href,
        action: "Review mailbox", key: "warmup:" + mailbox.id + ":" + key,
    }).catch(() => captureException(new Error("Mailbox warmup: could not notify team")));

    if (idleDays >= 14 && state.idleAnchor !== activity.toISOString()) {
        const rung = Math.max(0, mailbox.warmupDay - Math.floor(idleDays / 2));
        if (!await save(mailbox, { evaluatedDay: day, idleAnchor: activity.toISOString(), holdReason: "low_volume" }, rung, true, now)) return 0;
        await notify(mailbox.email + " restarted warmup after inactivity",
            "The daily sending cap was reduced after " + idleDays + " days without sending.", "idle:" + activity.toISOString());
        return 1;
    }
    if (!mailbox.isWarmingUp) return 0;
    const evaluated = state.evaluatedDay === day;
    if (evaluated && state.holdReason !== "awaiting_health") return 0;

    const target = mailbox.warmupTargetDays > 0 ? mailbox.warmupTargetDays : 30;
    const feedback = evaluated ? null : await previousDay(mailbox, today);
    const dailyCap = Math.min(mailbox.dailyLimit, 5 + 5 * mailbox.warmupDay);
    const enough = feedback && feedback.sent >= Math.max(1, Math.min(3, Math.ceil(dailyCap / 2)));
    const badFeedback = feedback?.complaints ? "complaints" : feedback && feedback.bounces * 25 > feedback.sent ? "bounces" : null;
    const advancedToday = mailbox.warmupLastAdvancedAt && mailbox.warmupLastAdvancedAt >= today;
    const rung = !badFeedback && enough && !advancedToday && mailbox.warmupDay < target
        ? mailbox.warmupDay + 1 : mailbox.warmupDay;
    let holdReason: HoldReason | null = badFeedback ?? (!enough && rung < target ? "low_volume" : null);

    if (rung >= target && !badFeedback) {
        const snapshot = await prisma.mailboxHealthSnapshot.findFirst({
            where: { teamId: mailbox.teamId, mailboxId: mailbox.id },
            orderBy: { checkedAt: "desc" }, select: { status: true, checkedAt: true },
        });
        if (snapshot?.status === "OK" && snapshot.checkedAt >= new Date(now.getTime() - 2 * DAY_MS) &&
            lastSend && lastSend >= new Date(now.getTime() - 7 * DAY_MS)) {
            if (!await save(mailbox, { ...state, evaluatedDay: day, holdReason: null }, rung, false, now)) return 0;
            await notify(mailbox.email + " finished warming up",
                "The mailbox reached its warmup target and passed its recent reputation check.", "finished:" + day);
            return 1;
        }
        holdReason = "awaiting_health";
    }

    if (evaluated && holdReason === state.holdReason) return 0;
    const updated = await save(mailbox, { ...state, evaluatedDay: day, holdReason }, rung, true, now);
    return updated && rung !== mailbox.warmupDay ? 1 : 0;
}

export async function advanceActivityBasedWarmup(now: Date) {
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: { status: "CONNECTED" },
        select: { id: true, teamId: true, email: true, createdAt: true, updatedAt: true, dailyLimit: true, metadata: true,
            isWarmingUp: true, warmupDay: true, warmupTargetDays: true, warmupLastAdvancedAt: true },
    });
    let count = 0;
    for (const mailbox of mailboxes) {
        try {
            count += await advance(mailbox, today, now);
        } catch (error) {
            captureException(new Error("Mailbox warmup sweep failed", { cause: error }));
        }
    }
    return { count };
}
