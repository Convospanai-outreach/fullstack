import { Prisma, type ConnectedMailbox } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { tryNormalizeDomain } from "@/lib/crm/domain";
import { decryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";
import { captureException } from "@/lib/sentry";
import { classifyRecipientProvider, type RecipientProvider } from "@/modules/email-campaigner/service/resendFeedback";
import { DOMAIN_NUDGE_TYPE, notifyOwners } from "./domainWatch";
import { jsonObject } from "./mailboxReputationHold";
import {
    assessMailboxReputation, lookupSpamhausDbl, type DomainReputation, type ProviderCounts,
    type ReputationCounts, type ReputationLevel, type ReputationSignal,
} from "./mailboxReputationSignals";

export const REPUTATION_NUDGE = "MAILBOX_REPUTATION";
export const DAY_MS = 86_400_000;
const DEBOUNCE_MS = 15 * 60_000;
const HISTORY_DAYS = 7;
const SEND_STATUSES = ["sent", "delivered", "opened", "clicked", "replied", "bounced", "complained", "unsubscribed", "failed"];
const FEEDBACK = ["SENT", "BOUNCED", "BOUNCE", "COMPLAINED", "DELIVERY_DELAYED", "DELIVERY_FAILED", "REPLY_RECEIVED", "OPENED", "OPEN", "CLICKED", "CLICK"];

export type ReputationClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Client = ReputationClient;
export type ReputationPause = { id: string; status: string; pausedBy: "reputation_guard"; pausedAt: string };
type Switch = { id: string; readyAt?: string; awaitingFreshHealthAfter?: string; dns?: { spf: boolean; dkim: boolean; dmarc: boolean }; checkedAt?: string };
export type MailboxReputationState = {
    state?: "OPEN" | "HELD" | "SWITCH_PENDING" | "WARMING" | "SWITCH_SCHEDULED" | "RESOLVED" | "DISMISSED";
    incidentId?: string;
    level?: ReputationLevel;
    signals?: ReputationSignal[];
    domainSignals?: DomainReputation;
    mailboxCounts?: ReputationCounts;
    teamCounts?: ReputationCounts;
    domainCounts?: ReputationCounts;
    providerCounts?: ProviderCounts;
    checkedAt?: string;
    dailyCheckedAt?: string;
    webhookCheckedAt?: string;
    webhookDueAt?: string | null;
    sendingHold?: { since: string; reason: string; blocksReplies: boolean } | null;
    campaigns?: ReputationPause[];
    sequences?: ReputationPause[];
    alerts?: { level: ReputationLevel; openedAt: string; lastAt: string; reminders: number };
    replacement?: Switch | null;
    switchedAt?: string;
};

type State = MailboxReputationState;

export function reputationState(metadata: unknown) {
    return jsonObject(jsonObject(metadata)["reputation"]) as State;
}

export async function updateReputation(client: Client, mailbox: Pick<ConnectedMailbox, "id" | "metadata">, state: State) {
    await client.connectedMailbox.update({
        where: { id: mailbox.id },
        data: { metadata: { ...jsonObject(mailbox.metadata), reputation: { ...reputationState(mailbox.metadata), ...state } } as Prisma.InputJsonObject },
    });
}

export async function lockReputation(client: Client, teamId: string) {
    await client.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtextextended(${"mailbox_reputation:" + teamId}, 0))`;
}

export function writeReputationAudit(client: Client, teamId: string, mailboxId: string, action: string, reason: string, actorId: string | null = null) {
    return client.auditLog.create({ data: {
        orgId: teamId, actorId, action, entity: "MailboxReputation", entityId: mailboxId,
        metadata: { reason, actor: actorId ?? "system" },
    } });
}

export function fixUrl(mailboxId: string) {
    const base = process.env["NEXT_PUBLIC_APP_URL"] || process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || "https://craftmyfunnel.live";
    return base.replace(/\/$/, "") + "/settings/domain-health/" + encodeURIComponent(mailboxId);
}

function empty(): ReputationCounts {
    return { sent: 0, bounced: 0, hardBounced: 0, complained: 0, delayed: 0, failed: 0 };
}

function add(target: ReputationCounts, source: ReputationCounts) {
    for (const key of Object.keys(target) as (keyof ReputationCounts)[]) target[key] += source[key];
}

async function measurements(teamId: string, mailbox: ConnectedMailbox, now: Date, onlyMailbox: boolean) {
    const start = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);
    const lastDay = new Date(now.getTime() - DAY_MS);
    const rows = await prisma.email.findMany({
        where: {
            campaign: { teamId },
            mailboxId: onlyMailbox ? mailbox.id : { not: null },
            OR: [
                { createdAt: { gte: start }, status: { in: SEND_STATUSES } },
                { events: { some: { type: "SENT", createdAt: { gte: start } } } },
            ],
        },
        select: {
            id: true, status: true, createdAt: true, mailboxId: true, openedAt: true, clickedAt: true, bouncedAt: true, repliedAt: true,
            mailbox: { select: { email: true } }, lead: { select: { email: true } },
            events: { where: { type: { in: FEEDBACK }, createdAt: { gte: start } }, select: { type: true, provider: true, createdAt: true, payload: true } },
        },
    });
    const mailboxCounts = empty();
    const domainCounts = empty();
    const teamCounts = empty();
    const providerCounts: ProviderCounts = {};
    const recent = { sentLast24h: 0, bouncedLast24h: 0, complainedLast24h: 0 };
    let replies = 0, opens = 0, clicks = 0;
    for (const email of rows) {
        const sent = email.events.find((event) => event.type === "SENT");
        const sentAt = sent?.createdAt ?? email.createdAt;
        const bounce = email.events.find((event) => ["BOUNCED", "BOUNCE"].includes(event.type));
        const complaint = email.events.find((event) => event.type === "COMPLAINED");
        const deliveryFailed = email.events.some((event) => event.type === "DELIVERY_FAILED") || email.status === "failed";
        const count = empty();
        count.sent = sent || email.status !== "failed" || deliveryFailed ? 1 : 0;
        count.bounced = bounce || (email.bouncedAt && email.bouncedAt >= start) ? 1 : 0;
        const detail = jsonObject(bounce?.payload);
        count.hardBounced = bounce?.provider === "RESEND"
            ? (detail["bounceType"] ?? jsonObject(detail["bounce"])["type"]) === "Permanent" ? 1 : 0
            : bounce?.type === "BOUNCE" ? 1 : 0;
        count.complained = complaint ? 1 : 0;
        count.delayed = email.events.some((event) => event.type === "DELIVERY_DELAYED") ? 1 : 0;
        count.failed = deliveryFailed ? 1 : 0;
        add(teamCounts, count);
        if (email.mailbox?.email.split("@")[1]?.toLowerCase() === mailbox.email.split("@")[1]?.toLowerCase()) add(domainCounts, count);
        if (email.mailboxId !== mailbox.id) continue;
        add(mailboxCounts, count);
        if (sentAt >= lastDay) recent.sentLast24h += count.sent;
        if ((bounce?.createdAt ?? email.bouncedAt ?? new Date(0)) >= lastDay) recent.bouncedLast24h += count.bounced;
        if (complaint && complaint.createdAt >= lastDay) recent.complainedLast24h++;
        if (email.repliedAt && email.repliedAt >= start) replies++;
        if (email.openedAt && email.openedAt >= start) opens++;
        if (email.clickedAt && email.clickedAt >= start) clicks++;
        const payloadProvider = email.events.map((event) => jsonObject(event.payload)["recipientProvider"]).find((value) => typeof value === "string" && value !== "unknown");
        const provider = typeof payloadProvider === "string"
            ? payloadProvider as RecipientProvider
            : await classifyRecipientProvider(email.lead.email ?? undefined, onlyMailbox);
        const total = providerCounts[provider] ?? (providerCounts[provider] = empty());
        add(total, count);
    }
    const bps = (count: number) => mailboxCounts.sent ? Math.min(10_000, Math.round(count * 10_000 / mailboxCounts.sent)) : 0;
    return {
        mailboxCounts, teamCounts, domainCounts, providerCounts, ...recent,
        bounceRateBasisPoints: bps(mailboxCounts.bounced), replyRateBasisPoints: bps(replies),
        openRateBasisPoints: bps(opens), clickRateBasisPoints: bps(clicks),
    };
}

async function resendDomainStatus(mailbox: ConnectedMailbox, domain: string) {
    if (mailbox.provider !== "RESEND") return undefined;
    try {
        const key = await decryptCredential(mailbox.encryptedAccessToken as EncryptedCredential | null);
        if (!key) return undefined;
        const resend = new Resend(key);
        const cached = await prisma.domainAuthenticationCheck.findUnique({
            where: { teamId_domain_provider: { teamId: mailbox.teamId, domain, provider: "RESEND" } },
            select: { providerDomainId: true },
        });
        let domainId = cached?.providerDomainId;
        if (!domainId) {
            const result = await resend.domains.list();
            domainId = result.data?.data.find((entry) => entry.name.toLowerCase() === domain)?.id;
        }
        if (!domainId) return undefined;
        return (await resend.domains.get(domainId)).data?.status;
    } catch {
        return undefined;
    }
}

async function domainReputation(mailbox: ConnectedMailbox, blocklists?: Map<string, ReturnType<typeof lookupSpamhausDbl>>): Promise<DomainReputation> {
    const domain = tryNormalizeDomain(mailbox.email.split("@")[1]);
    if (!domain) return {};
    const dbl = blocklists?.get(domain) ?? lookupSpamhausDbl(domain);
    blocklists?.set(domain, dbl);
    const [blocklist, resendStatus, dns] = await Promise.all([
        dbl,
        resendDomainStatus(mailbox, domain),
        prisma.overseerNudge.findFirst({ where: { teamId: mailbox.teamId, nudgeType: DOMAIN_NUDGE_TYPE, stage: domain, status: "OPEN" }, select: { id: true } }),
    ]);
    return { blocklist, dnsAlarm: Boolean(dns), ...(resendStatus ? { resendStatus } : {}) };
}

async function pauseAffected(client: Client, mailbox: ConnectedMailbox, now: Date) {
    const { id: mailboxId, teamId } = mailbox;
    const sequences = await client.campaignSequence.findMany({
        where: { teamId, status: "ACTIVE", OR: [{ senderMailboxIds: { has: mailboxId } }, { enrollments: { some: { mailboxId, status: "ACTIVE" } } }] },
        select: { id: true, status: true, campaignId: true },
    });
    const campaigns = await client.campaign.findMany({
        where: { teamId, status: { in: ["active", "scheduled"] }, OR: [
            { id: { in: sequences.flatMap((sequence) => sequence.campaignId ?? []) } },
            { aiConfig: { path: ["senderMailboxId"], equals: mailboxId } },
            { emails: { some: { mailboxId, createdAt: { gte: new Date(now.getTime() - HISTORY_DAYS * DAY_MS) } } } },
        ] },
        select: { id: true, status: true, name: true, ownerId: true, aiConfig: true },
    });
    const record = (row: { id: string; status: string }): ReputationPause => ({ id: row.id, status: row.status, pausedBy: "reputation_guard", pausedAt: now.toISOString() });
    const pausedCampaigns: ReputationPause[] = [];
    const pausedSequences: ReputationPause[] = [];
    for (const campaign of campaigns) {
        const changed = await client.campaign.updateMany({
            where: { id: campaign.id, teamId, status: campaign.status },
            data: { status: "paused", updatedAt: now, aiConfig: { ...jsonObject(campaign.aiConfig), reputationPauseMailboxId: mailboxId } },
        });
        if (changed.count) {
            pausedCampaigns.push(record(campaign));
            await client.activity.create({ data: { type: "CAMPAIGN_STATUS", message: "Campaign paused by mailbox reputation guard", campaignId: campaign.id, meta: { status: "paused", pausedBy: "reputation_guard" } } });
        }
    }
    for (const sequence of sequences) {
        const changed = await client.campaignSequence.updateMany({
            where: { id: sequence.id, teamId, status: "ACTIVE" },
            data: { status: "PAUSED", updatedAt: now },
        });
        if (changed.count) pausedSequences.push(record(sequence));
    }
    return { campaigns: pausedCampaigns, sequences: pausedSequences };
}

function describeSignals(signals: ReputationSignal[]) {
    return signals.map((signal) => {
        const code = signal.code.replaceAll("_", " ");
        const ratio = signal.count === undefined ? "" : " (" + signal.count + " of " + signal.sent + " sends)";
        return code + ratio + (signal.recipientProvider ? " for " + signal.recipientProvider : "");
    }).join(", ");
}

function nextAlert(state: State, level: ReputationLevel, now: Date) {
    const prior = state.alerts;
    const time = now.toISOString();
    if (level === "OK") return null;
    if (!prior || prior.level !== level) return { level, openedAt: time, lastAt: time, reminders: 0 };
    if (level === "WARNING") {
        return prior.reminders === 0 && now.getTime() - Date.parse(prior.openedAt) >= 3 * DAY_MS
            ? { ...prior, reminders: 1, lastAt: time } : null;
    }
    const hours = now.getTime() - Date.parse(prior.openedAt);
    const sinceLast = now.getTime() - Date.parse(prior.lastAt);
    const due = prior.reminders === 0 ? hours >= DAY_MS : prior.reminders === 1 ? hours >= 3 * DAY_MS : sinceLast >= DAY_MS;
    return due && prior.reminders < 7 ? { ...prior, reminders: prior.reminders + 1, lastAt: time } : null;
}

/** Part B can attach its pause/takeover transition here when its reply plans are on main. */
export async function onMailboxReputationChanged(_teamId: string, _mailboxId: string, _level: ReputationLevel): Promise<void> {}

export async function evaluateMailboxReputation(teamId: string, mailboxId: string, now = new Date(), mode: "daily" | "webhook" | "manual" = "manual", blocklists?: Map<string, ReturnType<typeof lookupSpamhausDbl>>) {
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId, status: "CONNECTED" } });
    if (!mailbox) return null;
    const prior = reputationState(mailbox.metadata);
    const gap = mode === "daily" ? DAY_MS : DEBOUNCE_MS;
    const last = mode === "daily" ? prior.dailyCheckedAt : prior.webhookCheckedAt;
    if (mode !== "manual" && last && now.getTime() - Date.parse(last) < gap) return null;
    const [measures, domainSignals] = await Promise.all([
        measurements(teamId, mailbox, now, mode === "webhook"),
        mode === "webhook" ? Promise.resolve(prior.domainSignals ?? {}) : domainReputation(mailbox, blocklists),
    ]);
    const assessed = assessMailboxReputation(measures.mailboxCounts, measures.providerCounts, domainSignals);
    const transition = await prisma.$transaction(async (client) => {
        await lockReputation(client, teamId);
        const current = await client.connectedMailbox.findFirst({ where: { id: mailboxId, teamId, status: "CONNECTED" } });
        if (!current) return null;
        const previous = reputationState(current.metadata);
        const checked = mode === "daily" ? previous.dailyCheckedAt : previous.webhookCheckedAt;
        if (mode !== "manual" && checked && now.getTime() - Date.parse(checked) < gap) return null;
        const observedAt = now.toISOString();
        const { mailboxCounts, teamCounts, domainCounts, providerCounts, ...snapshot } = measures;
        await client.mailboxHealthSnapshot.create({ data: {
            ...snapshot, mailboxId, teamId, status: assessed.level, checkedAt: now,
            healthScore: assessed.level === "CRITICAL" ? 20 : assessed.level === "WARNING" ? 70 : 100,
        } });
        const state: State = {
            ...previous, ...assessed, domainSignals, checkedAt: observedAt, mailboxCounts, providerCounts,
            ...(mode === "webhook" ? { webhookCheckedAt: observedAt, webhookDueAt: null } : { teamCounts, domainCounts }),
            ...(mode === "daily" ? { dailyCheckedAt: observedAt } : {}),
        };
        const mayOpen = assessed.level !== "OK" && (previous.state !== "DISMISSED" || assessed.level === "CRITICAL");
        const text = describeSignals(assessed.signals);
        const open = await client.overseerNudge.findFirst({ where: { teamId, nudgeType: REPUTATION_NUDGE, stage: mailboxId, status: "OPEN" } });
        if (mayOpen && !open && !previous.switchedAt) {
            const incident = await client.overseerNudge.create({
                data: { teamId, stage: mailboxId, nudgeType: REPUTATION_NUDGE, suggestion: text, stallDays: 0 },
            });
            state.state = "OPEN";
            state.incidentId = incident.id;
            delete state.alerts;
            await writeReputationAudit(client, teamId, mailboxId, "INCIDENT_OPENED", text);
        }
        if (assessed.level === "CRITICAL" && !previous.switchedAt) {
            const blocksReplies = assessed.signals.some((signal) => signal.code === "blocklist" || signal.code === "resend_failed");
            if (!previous.sendingHold) {
                const paused = await pauseAffected(client, current, now);
                state.state = "HELD";
                state.sendingHold = { since: observedAt, reason: text, blocksReplies };
                state.campaigns = paused.campaigns;
                state.sequences = paused.sequences;
                await writeReputationAudit(client, teamId, mailboxId, "SENDING_HELD", text);
            } else if (blocksReplies && !previous.sendingHold.blocksReplies) {
                state.sendingHold = { ...previous.sendingHold, blocksReplies, reason: text };
                await writeReputationAudit(client, teamId, mailboxId, "REPLIES_HELD", text);
            }
        }
        if (assessed.level === "OK") {
            if (open && !previous.sendingHold) {
                await client.overseerNudge.update({ where: { id: open.id }, data: { status: "DISMISSED", actedAt: now } });
                state.state = "RESOLVED";
                await writeReputationAudit(client, teamId, mailboxId, "INCIDENT_RESOLVED", "Measurements returned to the normal range");
            } else if (previous.state === "DISMISSED") {
                state.state = "RESOLVED";
            }
        }
        const alertLevel = state.sendingHold && !state.switchedAt && (open || mayOpen) ? "CRITICAL" : assessed.level;
        const alert = mayOpen || open ? nextAlert(state, alertLevel, now) : null;
        if (alert) state.alerts = alert;
        await updateReputation(client, current, state);
        return { state, priorLevel: previous.level, alert, text };
    });
    if (!transition) return null;
    if (transition.state.level !== transition.priorLevel) {
        await onMailboxReputationChanged(teamId, mailboxId, assessed.level);
    }
    if (transition.alert) {
        const campaigns = await prisma.campaign.findMany({
            where: { teamId, id: { in: (transition.state.campaigns ?? []).map((campaign) => campaign.id) } },
            select: { name: true, ownerId: true },
        });
        const critical = transition.alert.level === "CRITICAL";
        const title = critical ? "Action needed: " + mailbox.email + " is being marked as spam" : "Sending reputation warning for " + mailbox.email;
        const window = " In the seven days ending " + now.toISOString().slice(0, 10) + " (UTC).";
        const paused = campaigns.length ? " Paused campaigns: " + campaigns.map((campaign) => campaign.name).join(", ") + "." : "";
        await notifyOwners(teamId, title, (transition.text || transition.state.sendingHold?.reason || "A sending hold is open.") + "." + window + paused, {
            href: fixUrl(mailboxId), action: "Review and fix",
            key: "reputation:" + (transition.state.incidentId ?? mailboxId) + ":" + transition.alert.level + ":" + transition.alert.reminders,
            additionalUserIds: critical ? campaigns.flatMap((campaign) => campaign.ownerId ?? []) : [],
        }).catch(() => captureException(new Error("Mailbox reputation alert: could not notify team")));
    }
    return transition.state;
}

export async function requestMailboxReputationCheck(teamId: string, mailboxId: string, now = new Date()) {
    const evaluated = await evaluateMailboxReputation(teamId, mailboxId, now, "webhook");
    if (evaluated) return;
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId, status: "CONNECTED" }, select: { metadata: true } });
    const latest = reputationState(mailbox?.metadata).webhookCheckedAt;
    if (!latest || !mailbox) return;
    const processAt = new Date(Date.parse(latest) + DEBOUNCE_MS);
    const { JobQueue } = await import("@/lib/queue");
    await JobQueue.enqueue("mailbox_reputation_check", { teamId, mailboxId }, {
        teamId, processAt, idempotencyKey: "mailbox_reputation_check:" + mailboxId + ":" + processAt.getTime(),
    });
}

export async function runMailboxReputationWatch(now = new Date()) {
    const mailboxes = await prisma.connectedMailbox.findMany({ where: { status: "CONNECTED" }, select: { id: true, teamId: true } });
    const blocklists = new Map<string, ReturnType<typeof lookupSpamhausDbl>>();
    let checked = 0;
    for (const mailbox of mailboxes) {
        try {
            if (await evaluateMailboxReputation(mailbox.teamId, mailbox.id, now, "daily", blocklists)) checked++;
        } catch {
            captureException(new Error("Mailbox reputation watch: mailbox evaluation failed"));
        }
    }
    return checked;
}
