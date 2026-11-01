import { prisma } from "@/lib/db";
import { JobQueue, type JobPayload, type JobType } from "@/lib/queue";
import { readProvenance, type CopyProvenance } from "@/modules/email-campaigner/service/copyProvenance";

// Per-message approval for AI-written outreach. A worker that has just written an email or a
// LinkedIn message calls gateAiMessage before sending: unless the team opted out, the message is
// held as a MESSAGE_SEND approval, and approving it re-runs the original job with the stored text.

export const MESSAGE_ACTION_TYPE = "MESSAGE_SEND";
export const MESSAGE_APPROVAL_TTL_MS = 48 * 60 * 60 * 1000;
export const GENERATION_RETRIES = 2;

// Statuses beyond the PENDING / APPROVED / REJECTED that approvals already use.
const EXECUTING = "EXECUTING";
const SENT = "SENT";
const NEEDS_ATTENTION = "NEEDS_ATTENTION";

export type MessageChannel = "EMAIL" | "CONNECT" | "MESSAGE";

export type HeldMessage = {
    jobType: JobType;
    jobPayload: JobPayload;
    channel: MessageChannel;
    subject?: string;
    body: string;
    // Which prompt versions wrote the text (copyProvenance.ts). Reviewers approve or reject the text as
    // written, so it still describes what is sent.
    copyProvenance?: CopyProvenance;
};

type GateInput = HeldMessage & {
    teamId: string | null | undefined;
    leadId: string;
    // The campaign owner, used as the requester when there is one.
    requesterHint?: string | null | undefined;
};

export type GateResult =
    | { send: true }
    | { send: false; held: "approval"; approvalId: string }
    | { send: false; held: "needs_attention" };

export type ApprovedMessage =
    | { state: "ready"; subject?: string; body: string; copyProvenance?: CopyProvenance }
    | { state: "already_handled" | "expired" | "not_approved" };

function entityIdFor(leadId: string, channel: MessageChannel) {
    return `${leadId}:${channel}`;
}

// A team with no policy row is on the default, which is approval required.
export async function messageApprovalRequired(teamId: string): Promise<boolean> {
    const policy = await prisma.organizationPolicy.findUnique({
        where: { organizationId: teamId },
        select: { requiresMessageApproval: true },
    });
    return policy?.requiresMessageApproval ?? true;
}

// Runs `generate` up to 1 + retries times; null when every attempt threw or came back empty.
export async function generateWithRetry<T>(
    generate: () => Promise<T | null | undefined | "">,
    retries = GENERATION_RETRIES,
): Promise<T | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await generate();
            if (result) return result;
        } catch (error) {
            console.warn(`[MessageApproval] Generation attempt ${attempt + 1} failed`, error instanceof Error ? error.message : error);
        }
    }
    return null;
}

async function resolveRequesterId(teamId: string, hint?: string | null) {
    if (hint) return hint;
    const member = await prisma.user.findFirst({ where: { memberships: { some: { teamId } } }, select: { id: true } });
    return member?.id ?? null;
}

// Records that nothing was sent and a person needs to look: generation kept failing, or no
// approval could be requested. Best effort - the caller blocks the send either way.
export async function flagNeedsAttention(input: {
    teamId: string | null | undefined;
    leadId: string;
    channel: MessageChannel;
    reason: string;
    requesterHint?: string | null | undefined;
    // The job that failed to write the message, kept so a person can retry it or write the message
    // themselves from the approvals page.
    job?: { jobType: JobType; jobPayload: JobPayload };
}) {
    console.error("[MessageApproval] Message needs attention", { leadId: input.leadId, channel: input.channel, reason: input.reason });
    if (!input.teamId) return;
    try {
        const entityId = entityIdFor(input.leadId, input.channel);
        const existing = await prisma.approvalRequest.findFirst({
            where: { teamId: input.teamId, entityType: "Lead", entityId, actionType: MESSAGE_ACTION_TYPE, status: NEEDS_ATTENTION, createdAt: { gt: new Date(Date.now() - MESSAGE_APPROVAL_TTL_MS) } },
            select: { id: true },
        });
        if (existing) return;
        const requesterId = await resolveRequesterId(input.teamId, input.requesterHint);
        if (!requesterId) return;
        await prisma.approvalRequest.create({
            data: {
                teamId: input.teamId,
                requesterId,
                actionType: MESSAGE_ACTION_TYPE,
                entityType: "Lead",
                entityId,
                status: NEEDS_ATTENTION,
                reason: input.reason,
                payload: { channel: input.channel, leadId: input.leadId, ...(input.job ?? {}) } as any,
            },
        });
    } catch (error) {
        console.error("[MessageApproval] Could not record needs-attention", error instanceof Error ? error.message : error);
    }
}

// Decides whether a message the worker just wrote may go out now.
export async function gateAiMessage(input: GateInput): Promise<GateResult> {
    const { teamId, leadId, channel } = input;
    if (!teamId) {
        // Approvals belong to a team; with none to attach to, the safe answer is not to send.
        await flagNeedsAttention({ teamId, leadId, channel, reason: "No team found for this lead, so the message could not be sent for approval." });
        return { send: false, held: "needs_attention" };
    }
    if (!(await messageApprovalRequired(teamId))) return { send: true };

    const entityId = entityIdFor(leadId, channel);
    const now = new Date();
    const pending = await prisma.approvalRequest.findFirst({
        where: { teamId, entityType: "Lead", entityId, actionType: MESSAGE_ACTION_TYPE, status: "PENDING", autoDenyAt: { gt: now } },
        select: { id: true },
    });
    if (pending) return { send: false, held: "approval", approvalId: pending.id };

    const requesterId = await resolveRequesterId(teamId, input.requesterHint);
    if (!requesterId) {
        await flagNeedsAttention({ teamId, leadId, channel, reason: "No team member found to request approval from." });
        return { send: false, held: "needs_attention" };
    }

    const held: HeldMessage = { jobType: input.jobType, jobPayload: input.jobPayload, channel, body: input.body, ...(input.subject ? { subject: input.subject } : {}), ...(input.copyProvenance ? { copyProvenance: input.copyProvenance } : {}) };
    const request = await prisma.approvalRequest.create({
        data: {
            teamId,
            requesterId,
            actionType: MESSAGE_ACTION_TYPE,
            entityType: "Lead",
            entityId,
            status: "PENDING",
            tier: "QUEUED",
            reason: `AI-written ${channel.toLowerCase()} message waiting for review`,
            payload: { ...held, leadId },
            autoDenyAt: new Date(now.getTime() + MESSAGE_APPROVAL_TTL_MS),
        },
        select: { id: true },
    });
    return { send: false, held: "approval", approvalId: request.id };
}

type MessageRequest = { id: string; status: string; payload: unknown };

function readHeld(payload: unknown): HeldMessage | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Partial<HeldMessage>;
    if (typeof p.jobType !== "string" || typeof p.body !== "string" || !p.jobPayload || !p.channel) return null;
    return p as HeldMessage;
}

// Approving queues the original job again with the approved text, once: the job's idempotency
// key is the approval id, so a second click (or a retried request) cannot send twice. An
// approval past its 48 hours is never approved late.
export async function approveMessageSend(request: MessageRequest, teamId: string, reviewerId: string | null) {
    if (request.status === EXECUTING || request.status === SENT) return;
    if (request.status === "PENDING") {
        const decided = await prisma.approvalRequest.updateMany({
            where: { id: request.id, teamId, status: "PENDING", autoDenyAt: { gt: new Date() } },
            data: { status: "APPROVED", reviewerId, reviewedAt: new Date() },
        });
        if (decided.count === 0) throw new Error("This message approval has expired or was already decided.");
    } else if (request.status !== "APPROVED") {
        throw new Error(`This message approval is already ${request.status.toLowerCase().replaceAll("_", " ")}.`);
    }

    const held = readHeld(request.payload);
    if (!held) throw new Error("This message approval has no message to send.");
    await JobQueue.enqueue(held.jobType, { ...held.jobPayload, approvedMessageId: request.id }, {
        teamId,
        idempotencyKey: `approved_message_${request.id}`,
    });
}

// Rejecting only applies to a message still waiting; one already approved or sent is left alone.
export async function rejectMessageSend(requestId: string, teamId: string, reviewerId: string | null, reason?: string) {
    await prisma.approvalRequest.updateMany({
        where: { id: requestId, teamId, status: "PENDING" },
        data: { status: "REJECTED", reviewerId, reviewedAt: new Date(), ...(reason ? { reviewNote: reason } : {}) },
    });
}

// The re-run job claims the approval (APPROVED to EXECUTING) before it sends, so a duplicate or
// late run finds nothing to claim. Past its 48 hours the message is held, not sent.
export async function resolveApprovedMessage(approvalId: string, teamId: string): Promise<ApprovedMessage> {
    const claimed = await prisma.approvalRequest.updateMany({
        where: { id: approvalId, teamId, actionType: MESSAGE_ACTION_TYPE, status: "APPROVED", autoDenyAt: { gt: new Date() } },
        data: { status: EXECUTING },
    });
    const request = await prisma.approvalRequest.findFirst({
        where: { id: approvalId, teamId, actionType: MESSAGE_ACTION_TYPE },
        select: { id: true, status: true, autoDenyAt: true, payload: true },
    });
    if (!request) return { state: "not_approved" };

    if (claimed.count === 0) {
        if (request.status === EXECUTING || request.status === SENT) return { state: "already_handled" };
        if (request.status === "APPROVED") {
            await settleMessageApproval(approvalId, teamId, "NEEDS_ATTENTION", "The approval expired before the message could be sent.");
            return { state: "expired" };
        }
        return { state: "not_approved" };
    }

    const held = readHeld(request.payload);
    if (!held) {
        await settleMessageApproval(approvalId, teamId, "NEEDS_ATTENTION", "The approved message could not be read.");
        return { state: "not_approved" };
    }
    const copyProvenance = readProvenance(held.copyProvenance);
    return { state: "ready", body: held.body, ...(held.subject ? { subject: held.subject } : {}), ...(copyProvenance ? { copyProvenance } : {}) };
}

export async function settleMessageApproval(approvalId: string, teamId: string, outcome: "SENT" | "NEEDS_ATTENTION", note?: string) {
    await prisma.approvalRequest.updateMany({
        where: { id: approvalId, teamId, actionType: MESSAGE_ACTION_TYPE },
        data: { status: outcome === "SENT" ? SENT : NEEDS_ATTENTION, ...(note ? { reviewNote: note } : {}) },
    });
}
