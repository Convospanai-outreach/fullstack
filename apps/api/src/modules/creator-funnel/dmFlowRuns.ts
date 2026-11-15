import { prisma } from "@/lib/db";
import { complianceGuard } from "@/modules/governance/ComplianceGuard";
import { saveLandingAnswersToLead } from "@/modules/lead-properties/leadCustomFields";
import { WAIT_EXPIRY_MS, stepRun, type Action, type FlowEvent, type FlowStep, type RunState, type RunStatus } from "./dmFlowMachine";
import { isCreatorFunnelEnabled } from "./featureGate";
import { GraphError } from "./metaGraph";
import { PRIVATE_REPLY_MAX_AGE_MS, findMatchingTrigger, replyLink, sendMessageRequest } from "./keywordTriggers";
import { signLinkToken } from "./linkToken";
import { INSTAGRAM_TEXT_MAX_BYTES, MESSAGE_PLATFORM, findOrCreateContact, pageTokenFor, type AccountPlatform, type ReceivingAccount } from "./socialInbox";

// Runs of Instagram DM flows (dmFlowMachine.ts holds the rules). Two entry points:
// - the webhook (keywordTriggers.ts for comments and DMs, socialInbox.ts for replies) only writes
//   PENDING rows: a run is created or restarted, and a reply is queued against the person's run;
// - processPendingFlowEvents, run by the same worker tick as keyword auto-replies, claims those
//   rows, asks the state machine what to do, and sends through the auto-reply sender.
// Every row written from a webhook is unique per (run, source key), so Meta retries do nothing.

/** A finished run for the same person restarts only after this long (matches the auto-reply cooldown). */
export const FLOW_RESTART_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const TERMINAL = new Set<string>(["COMPLETED", "EXPIRED", "STOPPED", "FAILED"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const ERROR_TEXT_MAX = 300;

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === "P2002";
const errorText = (error: unknown) => (error instanceof Error ? error.message.slice(0, ERROR_TEXT_MAX) : "Unknown error");

const ACCOUNT_SELECT = {
    id: true,
    teamId: true,
    platform: true,
    externalId: true,
    parentExternalId: true,
    status: true,
    scopes: true,
    encryptedToken: true,
} as const;

/**
 * Starts a flow for a person from a keyword trigger that has one. sourceKey is "comment:<id>" or
 * "dm:<message id>", the same key the auto-reply uses. True when a run was started or restarted.
 */
export async function queueFlowStart(
    account: ReceivingAccount,
    trigger: { id: string; flowId: string; landingPageId?: string | null },
    start: { sourceKey: string; personKey: string },
    now: Date
): Promise<boolean> {
    const flow = await prisma.dmFlow.findFirst({
        where: { id: trigger.flowId, teamId: account.teamId, archivedAt: null },
        select: { id: true, steps: true },
    });
    if (!flow) return false;
    const steps = flow.steps as unknown as FlowStep[];
    if (steps.some((step) => step.type === "link") && !trigger.landingPageId) return false;

    const fresh = {
        teamId: account.teamId,
        socialAccountId: account.id,
        steps: flow.steps as object,
        stepIndex: 0,
        awaitingAnswer: false,
        status: "ACTIVE",
        waitingSince: null,
        lastInboundAt: null,
    };
    const existing = await prisma.dmFlowRun.findUnique({ where: { flowId_personKey: { flowId: flow.id, personKey: start.personKey } } });
    try {
        return await prisma.$transaction(async (tx) => {
            let runId: string;
            if (existing) {
                if (!TERMINAL.has(existing.status) || now.getTime() - existing.updatedAt.getTime() < FLOW_RESTART_COOLDOWN_MS) return false;
                const reset = await tx.dmFlowRun.updateMany({
                    where: { id: existing.id, version: existing.version },
                    data: { ...fresh, version: { increment: 1 } },
                });
                if (reset.count !== 1) return false;
                runId = existing.id;
            } else {
                const created = await tx.dmFlowRun.create({ data: { ...fresh, flowId: flow.id, personKey: start.personKey, version: 0 } });
                runId = created.id;
            }
            await tx.dmFlowEvent.create({ data: { runId, sourceKey: `start:${start.sourceKey}`, kind: "PENDING" } });
            return true;
        });
    } catch (error) {
        if (isUniqueViolation(error)) return false; // a redelivery that lost the race
        throw error;
    }
}

/** A message from a person who has a flow in progress: one PENDING row per run. True when at least one run has it. */
export async function queueFlowInbound(account: { id: string; teamId: string }, dm: { mid: string; senderId: string }): Promise<number> {
    const runs = await prisma.dmFlowRun.findMany({
        where: { teamId: account.teamId, socialAccountId: account.id, personKey: dm.senderId, status: { in: ["ACTIVE", "WAITING"] } },
        select: { id: true },
    });
    let queued = 0;
    for (const run of runs) {
        try {
            await prisma.dmFlowEvent.create({ data: { runId: run.id, sourceKey: `in:${dm.mid}`, kind: "PENDING" } });
            queued++;
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
        }
    }
    return queued;
}

/**
 * A DM from a person: it answers their run in progress if they have one; otherwise a keyword that
 * matches a flow trigger starts a run.
 */
export async function queueDmFlowMessage(account: ReceivingAccount, dm: { mid: string; senderId: string; text: string }, now: Date): Promise<void> {
    if ((await queueFlowInbound(account, dm)) > 0) return;
    const trigger = await findMatchingTrigger(account, "DM", dm.text, null);
    if (!trigger?.flowId) return;
    await queueFlowStart(account, { id: trigger.id, flowId: trigger.flowId, landingPageId: trigger.landingPageId }, { sourceKey: `dm:${dm.mid}`, personKey: dm.senderId }, now);
}

async function record(runId: string, sourceKey: string, kind: string, stepIndex: number | null, reason: string | null) {
    try {
        await prisma.dmFlowEvent.create({ data: { runId, sourceKey, kind, stepIndex, reason } });
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
    }
}

type RunRow = {
    id: string;
    teamId: string;
    flowId: string;
    socialAccountId: string;
    personKey: string;
    leadId: string | null;
    steps: unknown;
    stepIndex: number;
    awaitingAnswer: boolean;
    status: string;
    waitingSince: Date | null;
    lastInboundAt: Date | null;
    version: number;
    updatedAt: Date;
};

// Conditional on the version the worker read, so a run is never written by two passes.
async function saveRun(run: RunRow, next: RunState & { status: RunStatus }, leadId: string | null) {
    const done = await prisma.dmFlowRun.updateMany({
        where: { id: run.id, version: run.version },
        data: {
            status: next.status,
            stepIndex: next.stepIndex,
            awaitingAnswer: next.awaitingAnswer,
            waitingSince: next.waitingSince,
            lastInboundAt: next.lastInboundAt,
            leadId,
            version: { increment: 1 },
        },
    });
    if (done.count !== 1) throw new Error("The flow run changed while it was being processed.");
}

type SendOutcome = { ok: true; leadId: string | null } | { ok: false; uncertain: boolean; reason: string };

async function sendAction(
    run: RunRow,
    ev: { sourceKey: string; createdAt: Date },
    account: { id: string; teamId: string; platform: string; externalId: string; parentExternalId: string | null; status: string; scopes: string[]; encryptedToken: unknown },
    trigger: { id: string; landingPageId: string | null },
    action: Extract<Action, { type: "send" }>,
    leadId: string | null,
    now: Date
): Promise<SendOutcome> {
    const platform = account.platform as AccountPlatform;
    let text = action.step.text;
    if (action.step.type === "link") {
        const page = trigger.landingPageId
            ? await prisma.landingPage.findFirst({ where: { id: trigger.landingPageId, teamId: run.teamId, status: "published" }, select: { slug: true } })
            : null;
        if (!page) return { ok: false, uncertain: false, reason: "The landing page this flow links to isn't published." };
        // The link's sign-up merges into this person's lead through a reply row, as the auto-reply link does.
        const reply = await prisma.keywordTriggerReply.create({
            data: {
                teamId: run.teamId,
                triggerId: trigger.id,
                socialAccountId: account.id,
                sourceKey: `flow:${run.id}:${ev.sourceKey}:${action.stepIndex}`,
                personKey: run.personKey,
                leadId,
                status: "SENT",
            },
        });
        let token: string | null = null;
        try {
            token = signLinkToken(reply.id, now);
        } catch (error) {
            console.error("[DmFlows] Link signing failed; sending the plain link:", errorText(error));
        }
        const link = replyLink({ slug: page.slug, token, platform: account.platform, kind: "DM", triggerId: trigger.id, contentPostId: null });
        text = `${action.step.text}\n\n${link}`;
    }
    if (platform === "INSTAGRAM" && Buffer.byteLength(text, "utf8") > INSTAGRAM_TEXT_MAX_BYTES) {
        return { ok: false, uncertain: false, reason: "The message and link are over Instagram's 1,000-byte limit. Shorten the message." };
    }
    const token = await pageTokenFor(account);
    if (!token) return { ok: false, uncertain: false, reason: "The account's connection is missing. Reconnect it." };

    // The first message to someone who commented is the private reply to that comment. Anything
    // sent outside the window is only ever that one message.
    const isPrivateReply = ev.sourceKey.startsWith("start:comment:") && !action.inWindow;
    const commentId = ev.sourceKey.slice("start:comment:".length);
    const recipient = isPrivateReply ? { comment_id: commentId } : { id: run.personKey };
    let result: { message_id?: unknown; recipient_id?: unknown } | undefined;
    try {
        result = await sendMessageRequest(account, token, isPrivateReply ? "COMMENT" : "DM", recipient, text);
    } catch (error) {
        const uncertain = error instanceof GraphError && error.uncertain;
        return {
            ok: false,
            uncertain,
            reason: uncertain ? "Meta didn't confirm the message was sent; the flow stopped." : errorText(error),
        };
    }

    let contactLeadId = leadId;
    if (!contactLeadId && typeof result?.recipient_id === "string") {
        const { contact } = await findOrCreateContact(account as ReceivingAccount, result.recipient_id, {
            source: platform === "INSTAGRAM" ? "instagram_comment" : "facebook_comment",
        });
        contactLeadId = contact.leadId;
    }
    if (contactLeadId) {
        const messageId = typeof result?.message_id === "string" ? result.message_id : null;
        await prisma.message.create({
            data: {
                leadId: contactLeadId,
                content: text,
                direction: "OUTBOUND",
                platform: MESSAGE_PLATFORM[platform],
                sender: "Flow",
                status: "sent",
                isRead: true,
                externalId: messageId ? `${account.id}:${messageId}` : null,
            },
        });
    }
    return { ok: true, leadId: contactLeadId };
}

async function handleEvent(ev: { id: string; runId: string; sourceKey: string; createdAt: Date }, now: Date) {
    const run = (await prisma.dmFlowRun.findUnique({ where: { id: ev.runId } })) as RunRow | null;
    if (!run || TERMINAL.has(run.status)) return;
    if (!(await isCreatorFunnelEnabled(run.teamId))) return;

    const account = await prisma.socialAccount.findFirst({ where: { id: run.socialAccountId, teamId: run.teamId }, select: ACCOUNT_SELECT });
    const trigger = await prisma.keywordTrigger.findFirst({
        where: { flowId: run.flowId, teamId: run.teamId, active: true },
        select: { id: true, landingPageId: true },
    });
    // A switched-off auto-reply sends nothing; the run stays where it is.
    if (!account || !trigger) return;
    if (account.status !== "CONNECTED") {
        await record(run.id, ev.sourceKey, "FAILED", run.stepIndex, "The account is disconnected. Reconnect it in Settings.");
        await saveRun(run, { ...stateOf(run), status: "FAILED" }, run.leadId);
        return;
    }

    let leadId = run.leadId;
    if (!leadId) {
        const contact = await prisma.socialContact.findFirst({ where: { socialAccountId: account.id, externalUserId: run.personKey }, select: { leadId: true } });
        leadId = contact?.leadId ?? null;
    }
    if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
        if (lead?.status === "DNC") {
            await record(run.id, ev.sourceKey, "STOP", run.stepIndex, "The lead is on the do-not-contact list.");
            await saveRun(run, { ...stateOf(run), status: "STOPPED", awaitingAnswer: false, waitingSince: null }, leadId);
            return;
        }
    }

    const isStart = ev.sourceKey.startsWith("start:");
    let flowEvent: FlowEvent;
    if (isStart) {
        flowEvent = { kind: "start", origin: ev.sourceKey.startsWith("start:comment:") ? "COMMENT" : "DM", at: ev.createdAt };
    } else {
        const message = await prisma.message.findFirst({ where: { externalId: `${account.id}:${ev.sourceKey.slice("in:".length)}` }, select: { content: true, createdAt: true } });
        flowEvent = { kind: "inbound", at: message?.createdAt ?? ev.createdAt, text: message?.content ?? "" };
    }
    const allowance = isStart && flowEvent.kind === "start" && flowEvent.origin === "COMMENT" && now.getTime() - ev.createdAt.getTime() < PRIVATE_REPLY_MAX_AGE_MS ? 1 : 0;
    const dailySent = await prisma.dmFlowEvent.count({
        where: {
            kind: "SENT",
            createdAt: { gte: new Date(now.getTime() - DAY_MS) },
            run: { teamId: run.teamId, socialAccountId: run.socialAccountId, personKey: run.personKey },
        },
    });

    const steps = run.steps as unknown as FlowStep[];
    const { state: next, actions } = stepRun(steps, stateOf(run), flowEvent, { allowance, dailySent });
    let final: RunState & { status: RunStatus } = next as RunState & { status: RunStatus };
    let currentLead = leadId;

    for (const action of actions) {
        if (action.type === "stop") {
            if (currentLead) await complianceGuard.enforceOptOut(currentLead, "Instagram flow: the person asked to stop");
            await record(run.id, ev.sourceKey, "STOP", run.stepIndex, "The person asked to stop.");
            continue;
        }
        if (action.type === "hold") {
            const reason =
                action.reason === "DAILY_CAP"
                    ? "The daily message limit for this person was reached; the message waits."
                    : "Meta only allows messages within the 24-hour window after the person's last message; this one waits for their reply.";
            await record(run.id, `${ev.sourceKey}:hold:${action.stepIndex}`, "SKIPPED", action.stepIndex, reason);
            continue;
        }
        if (action.type === "save_answer") {
            if (currentLead) await saveLandingAnswersToLead(run.teamId, currentLead, { answers: { [action.property]: action.value } });
            await record(run.id, ev.sourceKey, "ANSWER", action.stepIndex, null);
            continue;
        }
        const outcome = await sendAction(run, ev, account, trigger, action, currentLead, now);
        if (!outcome.ok) {
            await record(run.id, ev.sourceKey, outcome.uncertain ? "UNCONFIRMED" : "FAILED", action.stepIndex, outcome.reason);
            final = { ...final, status: "FAILED", awaitingAnswer: false, waitingSince: null };
            break;
        }
        currentLead = outcome.leadId;
        await record(run.id, `${ev.sourceKey}:send:${action.stepIndex}`, "SENT", action.stepIndex, null);
    }
    await saveRun(run, final, currentLead);
}

function stateOf(run: RunRow): RunState & { status: RunStatus } {
    return {
        status: run.status as RunStatus,
        stepIndex: run.stepIndex,
        awaitingAnswer: run.awaitingAnswer,
        waitingSince: run.waitingSince,
        lastInboundAt: run.lastInboundAt,
    };
}

/**
 * One worker pass: expires runs that waited too long, then claims and handles PENDING rows, oldest
 * first. A row is claimed before anything is sent, so a crash never sends it twice; a row that fails
 * is marked FAILED and not retried.
 */
export async function processPendingFlowEvents(now = new Date(), limit = 20) {
    await prisma.dmFlowRun.updateMany({
        where: { status: "WAITING", waitingSince: { lt: new Date(now.getTime() - WAIT_EXPIRY_MS) } },
        data: { status: "EXPIRED", waitingSince: null },
    });
    const pending = await prisma.dmFlowEvent.findMany({
        where: { kind: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: { id: true, runId: true, sourceKey: true, createdAt: true },
    });
    let handled = 0;
    for (const ev of pending) {
        const claimed = await prisma.dmFlowEvent.updateMany({ where: { id: ev.id, kind: "PENDING" }, data: { kind: "PROCESSING" } });
        if (claimed.count !== 1) continue;
        try {
            await handleEvent(ev, now);
            await prisma.dmFlowEvent.updateMany({ where: { id: ev.id, kind: "PROCESSING" }, data: { kind: "DONE" } });
        } catch (error) {
            console.error(`[DmFlows] Event ${ev.id} failed:`, errorText(error));
            await prisma.dmFlowEvent.updateMany({ where: { id: ev.id, kind: "PROCESSING" }, data: { kind: "FAILED", reason: errorText(error) } });
        }
        handled++;
    }
    return { handled };
}
