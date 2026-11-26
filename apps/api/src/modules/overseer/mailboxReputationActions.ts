import { domainToASCII } from "node:url";
import { Prisma, type ConnectedMailbox } from "@prisma/client";
import { APIError } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { captureException } from "@/lib/sentry";
import { checkDomainDeliverabilitySignals, dkimSelectorFromMetadata } from "@/modules/email-campaigner/service/domainAuthService";
import { DOMAIN_NUDGE_TYPE, notifyOwners } from "./domainWatch";
import {
    DAY_MS, REPUTATION_NUDGE, evaluateMailboxReputation, fixUrl, lockReputation, onMailboxReputationChanged, reputationState,
    updateReputation, writeReputationAudit, type MailboxReputationState, type ReputationClient,
} from "./mailboxReputation";
import { jsonObject, mailboxReputationGuardEnabled, mailboxSendingHold } from "./mailboxReputationHold";

export const KEEP_SENDING_TEXT = "KEEP SENDING";
const PSL_URL = "https://publicsuffix.org/list/public_suffix_list.dat";
let suffixes: { expiresAt: number; rules: Promise<Set<string>> } | undefined;

function suffixRules() {
    const now = Date.now();
    if (suffixes && suffixes.expiresAt > now) return suffixes.rules;
    const fallback = suffixes;
    const rules = fetch(PSL_URL, { signal: AbortSignal.timeout(3_000), redirect: "error" }).then(async (response) => {
        if (!response.ok) throw new Error("Suffix list unavailable");
        const result = new Set<string>();
        for (const line of (await response.text()).split(/\r?\n/)) {
            const rule = line.trim();
            if (!rule || rule.startsWith("//")) continue;
            const prefix = rule.startsWith("!") ? "!" : rule.startsWith("*.") ? "*." : "";
            const ascii = domainToASCII(rule.slice(prefix.length));
            if (ascii) result.add(prefix + ascii);
        }
        if (result.size < 1000) throw new Error("Incomplete suffix list");
        return result;
    }).catch(() => {
        if (fallback) return fallback.rules;
        suffixes = undefined;
        throw new APIError("Could not verify the replacement domain. Try again.", 503, "DOMAIN_CHECK_UNAVAILABLE");
    });
    suffixes = { expiresAt: now + DAY_MS, rules };
    return rules;
}

export function registrableDomain(email: string, rules: ReadonlySet<string>) {
    const domain = email.split("@")[1];
    if (!domain) return null;
    const labels = domainToASCII(domain).toLowerCase().replace(/\.$/, "").split(".");
    if (labels.length < 2) return null;
    let suffixLength = 1;
    for (let i = labels.length - 1; i >= 0; i--) {
        const tail = labels.slice(i).join(".");
        if (rules.has("!" + tail)) return tail;
        if (rules.has(tail) || (i > 0 && rules.has("*." + tail))) {
            suffixLength = Math.max(suffixLength, labels.length - i + (rules.has("*." + tail) && i > 0 ? 1 : 0));
        }
    }
    return labels.length > suffixLength ? labels.slice(-suffixLength - 1).join(".") : null;
}

async function mailboxFor(client: Pick<ReputationClient, "connectedMailbox">, teamId: string, id: string) {
    const mailbox = await client.connectedMailbox.findFirst({ where: { id, teamId, status: "CONNECTED" } });
    if (!mailbox) throw new APIError("Connected mailbox not found", 404, "MAILBOX_NOT_FOUND");
    return mailbox;
}

async function assertReplacement(oldMailbox: ConnectedMailbox, candidate: ConnectedMailbox) {
    const rules = await suffixRules();
    const oldDomain = registrableDomain(oldMailbox.email, rules);
    const newDomain = registrableDomain(candidate.email, rules);
    if (!oldDomain || !newDomain || oldDomain === newDomain) {
        throw new APIError("Choose a mailbox on a different registered domain", 409, "SAME_SENDING_DOMAIN");
    }
    if (mailboxSendingHold(candidate.metadata) || reputationState(candidate.metadata).level === "CRITICAL") {
        throw new APIError("Choose a mailbox without a sending hold", 409, "REPLACEMENT_HELD");
    }
}

async function dnsFor(mailbox: ConnectedMailbox) {
    const domain = mailbox.email.split("@")[1] ?? "";
    return checkDomainDeliverabilitySignals(domain, mailbox.provider, dkimSelectorFromMetadata(mailbox.metadata));
}

function dnsOk(dns: { spf: boolean; dkim: boolean; dmarc: boolean }) {
    return dns.spf && dns.dkim && dns.dmarc;
}

export async function listMailboxReputation(teamId: string) {
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: { teamId }, orderBy: { email: "asc" },
        select: { id: true, email: true, status: true, provider: true, metadata: true, isWarmingUp: true, warmupDay: true, warmupTargetDays: true },
    });
    return mailboxes.map(({ metadata, ...mailbox }) => ({ ...mailbox, reputation: reputationState(metadata) }));
}

export async function getMailboxReputation(teamId: string, mailboxId: string) {
    const mailboxes = await listMailboxReputation(teamId);
    const mailbox = mailboxes.find((item) => item.id === mailboxId);
    if (!mailbox) throw new APIError("Mailbox not found", 404, "MAILBOX_NOT_FOUND");
    const [history, campaigns] = await Promise.all([
        prisma.mailboxHealthSnapshot.findMany({ where: { teamId, mailboxId }, take: 30, orderBy: { checkedAt: "desc" } }),
        prisma.campaign.findMany({
            where: { teamId, id: { in: (mailbox.reputation.campaigns ?? []).map((item) => item.id) } }, select: { id: true, name: true, status: true },
        }),
    ]);
    const candidates = mailboxes.filter((item) => item.id !== mailboxId && item.status === "CONNECTED" && !item.reputation.sendingHold);
    return { mailbox, history, campaigns, candidates };
}

export async function setDefaultSender(client: ReputationClient, teamId: string, mailboxId: string | null) {
    const key = "defaultSenderMailboxId";
    await client.$executeRaw(Prisma.sql`
        UPDATE "Team" SET "sendSafety" = jsonb_set(
            CASE WHEN jsonb_typeof("sendSafety") = 'object' THEN "sendSafety" ELSE '{}'::jsonb END,
            ARRAY[${key}]::text[], ${JSON.stringify(mailboxId)}::jsonb
        ), "updatedAt" = now()
        WHERE "id" = ${teamId}`);
}

async function resumePaused(client: ReputationClient, mailbox: ConnectedMailbox, state: MailboxReputationState, now: Date, replacementId?: string) {
    for (const item of state.sequences ?? []) {
        // A human edit after the guard pause clears our authority to resume.
        const sequence = await client.campaignSequence.findFirst({
            where: { id: item.id, teamId: mailbox.teamId, status: "PAUSED", updatedAt: new Date(item.pausedAt) },
        });
        if (!sequence || item.pausedBy !== "reputation_guard") continue;
        const senderMailboxIds = replacementId
            ? [...new Set(sequence.senderMailboxIds.length ? sequence.senderMailboxIds.map((id) => id === mailbox.id ? replacementId : id) : [replacementId])]
            : sequence.senderMailboxIds;
        const changed = await client.campaignSequence.updateMany({
            where: { id: sequence.id, teamId: mailbox.teamId, status: "PAUSED", updatedAt: new Date(item.pausedAt) },
            data: { senderMailboxIds, status: item.status },
        });
        if (!changed.count || !replacementId) continue;
        await client.sequenceStepRun.updateMany({
            where: {
                teamId: mailbox.teamId, mailboxId: mailbox.id, enrollment: { sequenceId: sequence.id, status: "ACTIVE" },
                status: { in: ["SCHEDULED", "RETRY_SCHEDULED", "AWAITING_TOKEN_APPROVAL"] },
            },
            data: { mailboxId: replacementId },
        });
        await client.sequenceEnrollment.updateMany({
            where: { teamId: mailbox.teamId, sequenceId: sequence.id, status: "ACTIVE", mailboxId: mailbox.id },
            data: { mailboxId: replacementId },
        });
    }
    for (const item of state.campaigns ?? []) {
        if (item.pausedBy !== "reputation_guard") continue;
        const where = { id: item.id, teamId: mailbox.teamId, status: "paused", updatedAt: new Date(item.pausedAt) };
        const campaign = await client.campaign.findFirst({ where, select: { aiConfig: true } });
        if (!campaign) continue;
        const aiConfig = jsonObject(campaign.aiConfig);
        delete aiConfig["reputationPauseMailboxId"];
        if (replacementId) aiConfig["senderMailboxId"] = replacementId;
        const changed = await client.campaign.updateMany({
            where,
            data: { status: item.status, updatedAt: now, aiConfig },
        });
        if (changed.count) await client.activity.create({
            data: { type: "CAMPAIGN_STATUS", message: "Campaign resumed by mailbox reputation guard", campaignId: item.id, meta: { status: item.status, resumedBy: "reputation_guard" } },
        });
    }
}

type Action =
    | { action: "switch"; replacementId: string }
    | { action: "keep"; confirmation: string }
    | { action: "recheck" | "delay" | "resume" | "disconnect" };

export async function actOnMailboxReputation(teamId: string, mailboxId: string, userId: string, action: Action, now = new Date()) {
    const old = await mailboxFor(prisma, teamId, mailboxId);
    const replacement = action.action === "switch" ? await mailboxFor(prisma, teamId, action.replacementId) : null;
    if (replacement) await assertReplacement(old, replacement);
    if (action.action === "recheck") {
        const dns = await dnsFor(old);
        if (dnsOk(dns)) await prisma.overseerNudge.updateMany({
            where: { teamId, nudgeType: DOMAIN_NUDGE_TYPE, stage: dns.domain, status: "OPEN" },
            data: { status: "DISMISSED", actedAt: now },
        });
        await evaluateMailboxReputation(teamId, mailboxId, now);
    }

    await prisma.$transaction(async (tx) => {
        await lockReputation(tx, teamId);
        const mailbox = await mailboxFor(tx, teamId, mailboxId);
        const state = reputationState(mailbox.metadata);
        let reason: string;
        if (action.action === "switch" && replacement) {
            if (!state.sendingHold || state.switchedAt || state.replacement) throw new APIError("This mailbox cannot start a new switch", 409, "SWITCH_UNAVAILABLE");
            const next = await mailboxFor(tx, teamId, replacement.id);
            if (next.email !== replacement.email || mailboxSendingHold(next.metadata)) throw new APIError("Replacement mailbox changed", 409, "REPLACEMENT_UNAVAILABLE");
            await updateReputation(tx, mailbox, { state: "SWITCH_PENDING", replacement: { id: next.id } });
            reason = "Selected replacement mailbox " + next.id;
        } else if (action.action === "keep") {
            if (state.level !== "WARNING" || state.sendingHold || state.state !== "OPEN" || action.confirmation !== KEEP_SENDING_TEXT) {
                throw new APIError("Confirm the warning using the displayed text", 409, "WARNING_CONFIRMATION_REQUIRED");
            }
            await closeIncident(tx, mailbox, state, now, "DISMISSED");
            await updateReputation(tx, mailbox, { state: "DISMISSED" });
            reason = "Confirmed continued sending during a warning";
        } else if (action.action === "delay") {
            if (!state.replacement?.readyAt || state.state !== "SWITCH_SCHEDULED") throw new APIError("No switch is scheduled", 409, "SWITCH_UNAVAILABLE");
            const readyAt = new Date(Math.max(Date.parse(state.replacement.readyAt), now.getTime()) + DAY_MS).toISOString();
            await updateReputation(tx, mailbox, { replacement: { ...state.replacement, readyAt } });
            reason = "Delayed sender switch to " + readyAt;
        } else if (action.action === "resume") {
            if (!state.sendingHold || state.switchedAt || state.level !== "OK" || now.getTime() - Date.parse(state.sendingHold.since) < 14 * DAY_MS) {
                throw new APIError("Resume becomes available after 14 days when the mailbox is healthy", 409, "RESUME_UNAVAILABLE");
            }
            await tx.connectedMailbox.update({ where: { id: mailboxId }, data: { isWarmingUp: true, warmupDay: 0, warmupLastAdvancedAt: now } });
            await resumePaused(tx, mailbox, state, now);
            await closeIncident(tx, mailbox, state, now, "ACTED");
            await updateReputation(tx, mailbox, { state: "RESOLVED", sendingHold: null, replacement: null });
            reason = "Resumed at day zero of the warmup ramp";
        } else if (action.action === "disconnect") {
            if (!state.switchedAt || now.getTime() - Date.parse(state.switchedAt) < 30 * DAY_MS) {
                throw new APIError("Keep the mailbox connected for incoming replies for 30 days", 409, "REPLY_RETENTION");
            }
            await tx.connectedMailbox.update({ where: { id: mailboxId }, data: { status: "DISCONNECTED" } });
            reason = "Disconnected after the reply retention window";
        } else {
            reason = "Rechecked DNS and mailbox measurements";
        }
        await writeReputationAudit(tx, teamId, mailboxId, action.action.toUpperCase(), reason, userId);
    });
    return getMailboxReputation(teamId, mailboxId);
}

async function closeIncident(tx: ReputationClient, mailbox: ConnectedMailbox, state: MailboxReputationState, now: Date, status: "ACTED" | "DISMISSED") {
    if (state.incidentId) await tx.overseerNudge.updateMany({
        where: { id: state.incidentId, teamId: mailbox.teamId, stage: mailbox.id, nudgeType: REPUTATION_NUDGE, status: "OPEN" }, data: { status, actedAt: now },
    });
}

async function progressSwitch(mailbox: ConnectedMailbox, now: Date) {
    const state = reputationState(mailbox.metadata);
    const replacement = state.replacement;
    if (!replacement || state.switchedAt) return;
    const next = await prisma.connectedMailbox.findFirst({ where: { id: replacement.id, teamId: mailbox.teamId, status: "CONNECTED" } });
    if (!next) return;
    const due = replacement.readyAt && Date.parse(replacement.readyAt) <= now.getTime();
    const lastChecked = replacement.checkedAt ? Date.parse(replacement.checkedAt) : 0;
    if (!due && now.getTime() - lastChecked < 60 * 60_000) return;
    const { spf, dkim, dmarc } = await dnsFor(next);
    const dns = { spf, dkim, dmarc };
    const notice = await prisma.$transaction(async (tx) => {
        await lockReputation(tx, mailbox.teamId);
        const old = await mailboxFor(tx, mailbox.teamId, mailbox.id);
        const current = reputationState(old.metadata);
        const plan = current.replacement;
        if (!plan || current.switchedAt || plan.id !== replacement.id || plan.checkedAt !== replacement.checkedAt || plan.readyAt !== replacement.readyAt) return null;
        const candidate = await mailboxFor(tx, mailbox.teamId, next.id);
        if (candidate.email !== next.email) return null;
        const latest = await tx.mailboxHealthSnapshot.findFirst({ where: { teamId: old.teamId, mailboxId: next.id }, orderBy: { checkedAt: "desc" }, select: { status: true, checkedAt: true } });
        const open = await tx.overseerNudge.findFirst({ where: { teamId: old.teamId, stage: next.id, nudgeType: REPUTATION_NUDGE, status: "OPEN" }, select: { id: true } });
        const checkedAt = now.toISOString();
        const update = { ...plan, dns, checkedAt };
        let warming = candidate.isWarmingUp;
        if (dnsOk(dns) && warming && candidate.warmupDay >= candidate.warmupTargetDays) {
            await tx.connectedMailbox.update({ where: { id: candidate.id }, data: { isWarmingUp: false } });
            warming = false;
        }
        const newIncident = latest && latest.status !== "OK" && (!plan.awaitingFreshHealthAfter || latest.checkedAt > new Date(plan.awaitingFreshHealthAfter));
        if (newIncident) {
            const retry = { ...update, readyAt: undefined, awaitingFreshHealthAfter: latest.checkedAt.toISOString() };
            await updateReputation(tx, old, { state: "WARMING", replacement: retry });
            await writeReputationAudit(tx, old.teamId, old.id, "WARMUP_WAIT_RESTARTED", "Replacement mailbox raised a reputation warning");
            return { kind: "warning" as const, when: retry.awaitingFreshHealthAfter };
        }
        const hasFreshHealth = latest?.status === "OK" && latest.checkedAt >= new Date(now.getTime() - DAY_MS * 2) &&
            (!plan.awaitingFreshHealthAfter || latest.checkedAt > new Date(plan.awaitingFreshHealthAfter));
        if (!dnsOk(dns) || warming || !hasFreshHealth || open || mailboxSendingHold(candidate.metadata)) {
            const stage = dnsOk(dns) ? "WARMING" : "SWITCH_PENDING";
            await updateReputation(tx, old, { state: stage, replacement: { ...update, readyAt: undefined } });
            if (current.state !== stage) await writeReputationAudit(tx, old.teamId, old.id, stage, "Waiting for replacement DNS and warmup requirements");
            return null;
        }
        if (!plan.readyAt) {
            const readyAt = new Date(now.getTime() + DAY_MS).toISOString();
            await updateReputation(tx, old, { state: "SWITCH_SCHEDULED", replacement: { ...update, readyAt } });
            await writeReputationAudit(tx, old.teamId, old.id, "SWITCH_SCHEDULED", "Replacement passed DNS, warmup and reputation checks");
            return { kind: "scheduled" as const, when: readyAt };
        }
        if (!due) {
            await updateReputation(tx, old, { replacement: update });
            return null;
        }
        await resumePaused(tx, old, current, now, next.id);
        await setDefaultSender(tx, old.teamId, candidate.id);
        await closeIncident(tx, old, current, now, "ACTED");
        await updateReputation(tx, old, { state: "RESOLVED", replacement: update, switchedAt: checkedAt });
        await writeReputationAudit(tx, old.teamId, old.id, "SENDER_SWITCHED", "Moved paused work and the default sender to " + candidate.id);
        return { kind: "switched" as const, when: checkedAt };
    });
    if (!notice) return;
    const key = "reputation-switch:" + mailbox.id + ":" + notice.kind + ":" + notice.when;
    const options = { href: fixUrl(mailbox.id), action: "Review and fix", key };
    if (notice.kind === "scheduled") {
        await notifyOwners(mailbox.teamId, "Your campaigns resume from " + next.email + " on " + notice.when.slice(0, 10),
            "The replacement is ready. The switch is scheduled for " + notice.when + ".", { ...options, action: "Delay", href: options.href + "?delay=1" });
    } else if (notice.kind === "warning") {
        await notifyOwners(mailbox.teamId, "Replacement mailbox needs attention", "The waiting period restarted after " + next.email + " raised a reputation warning.", options);
    } else {
        await onMailboxReputationChanged(mailbox.teamId, mailbox.id, "CRITICAL");
        await notifyOwners(mailbox.teamId, "Campaigns resumed from " + next.email, "Paused campaigns can send again through the replacement mailbox.", options);
        await notifyOwners(mailbox.teamId, "New campaigns will now send from " + next.email, "You can change the default sender in Settings > Mailboxes.", { ...options, key: key + ":default" });
    }
}

export async function progressMailboxSwitches(now = new Date()) {
    if (!mailboxReputationGuardEnabled()) return;
    const mailboxes = await prisma.connectedMailbox.findMany({ where: { status: "CONNECTED" } });
    for (const mailbox of mailboxes) {
        try {
            await progressSwitch(mailbox, now);
        } catch {
            captureException(new Error("Mailbox reputation: replacement check failed"));
        }
    }
}
